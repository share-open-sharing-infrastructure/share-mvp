import type PocketBase from 'pocketbase';
import type { LendingRequirements, UnmetRequirement, RequirementSetting } from '$lib/types/models';
import { texts } from '$lib/texts';
import { upsertSingletonRow } from '$lib/server/singletonRow';

/**
 * Lender-defined borrower requirements (issues #423 / #389).
 *
 * A lender configures, per account, which requirements a borrower must satisfy
 * before they may request the lender's items (visibility is NOT affected — that
 * stays with trusteesOnly/groups). This module mirrors the authoritative backend
 * hook (allerleih-backend/pb_hooks/lending_requirements.pb.js) purely for UX:
 * the item detail page uses it to disable the request button and tell the
 * borrower what's missing. The backend hook is the source of truth.
 *
 * Extending a requirement type needs ONLY: a column on the `lending_requirements`
 * collection (backend migration), a matching field on the `LendingRequirements`
 * type, copy under `texts.lendingRequirements.<key>`, and a registry entry below
 * — plus the same registry entry in the backend hook. The owner settings UI, the
 * load/save path and the borrower CTA are all driven from this registry, so no
 * other frontend wiring is needed.
 */

/** Backing columns on `lending_requirements` (excludes base/owner fields). */
type RequirementField = 'requireVerifiedEmail' | 'requireAddress';

/** Minimal shape of the borrower needed to evaluate requirements. */
type Borrower = { verified?: boolean; city?: string } & Record<string, unknown>;

type RequirementContext = {
	pb: PocketBase;
	ownerId: string;
	borrower: Borrower;
};

type RequirementDef = UnmetRequirement & {
	/** DB column / form field name backing this requirement. */
	field: RequirementField;
	/** Friendly name, used in the server-side "requirements not met" error message. */
	label: string;
	/** Owner-facing toggle label + help (profile settings). */
	settingsLabel: string;
	settingsHelp: string;
	isEnabled: (req: LendingRequirements) => boolean;
	evaluate: (ctx: RequirementContext) => boolean | Promise<boolean>;
};

const t = texts.lendingRequirements;

/**
 * The requirement registry — the single source of truth for the frontend.
 * Order = display order (roughly increasing strictness). Keep keys/logic in sync
 * with the backend hook (which is the authoritative enforcer).
 */
export const requirementRegistry: RequirementDef[] = [
	{
		key: 'verifiedEmail',
		field: 'requireVerifiedEmail',
		settingsLabel: t.verifiedEmail.settingsLabel,
		settingsHelp: t.verifiedEmail.settingsHelp,
		label: t.verifiedEmail.label,
		actionLabel: t.verifiedEmail.actionLabel,
		actionHref: '/user/profile#email',
		isEnabled: (req) => !!req.requireVerifiedEmail,
		evaluate: ({ borrower }) => !!borrower.verified
	},
	{
		key: 'address',
		field: 'requireAddress',
		settingsLabel: t.address.settingsLabel,
		settingsHelp: t.address.settingsHelp,
		label: t.address.label,
		actionLabel: t.address.actionLabel,
		actionHref: '/user/profile#address',
		isEnabled: (req) => !!req.requireAddress,
		evaluate: ({ borrower }) => (borrower.city ?? '').trim() !== ''
	}
];

/** DB column names of all requirement toggles (for building the save payload). */
export const requirementFields: RequirementField[] = requirementRegistry.map((d) => d.field);

/**
 * Derives the owner-facing settings list (one toggle per requirement) from the
 * registry + the owner's current row. Drives the profile settings UI.
 */
export function getRequirementSettings(req: LendingRequirements | null): RequirementSetting[] {
	return requirementRegistry.map((d) => ({
		key: d.key,
		field: d.field,
		settingsLabel: d.settingsLabel,
		settingsHelp: d.settingsHelp,
		enabled: req ? d.isEnabled(req) : false
	}));
}

/**
 * Returns the owner's configured requirements, or null if none are set.
 *
 * `requestKey` MUST be distinct per concurrent call site on the same `pb` (mirrors
 * `getUserPreferences`): PocketBase's auto-cancellation keys by method+path, so a
 * second identical GET aborts the first — and the `catch` below turns that
 * `AbortError` into `null`, which reads as "no requirements" and opens the gate.
 */
export async function getOwnerRequirements(
	pb: PocketBase,
	ownerId: string,
	requestKey = 'owner-requirements'
): Promise<LendingRequirements | null> {
	try {
		return await pb
			.collection('lending_requirements')
			.getFirstListItem<LendingRequirements>(pb.filter('owner = {:ownerId}', { ownerId }), {
				requestKey,
			});
	} catch {
		// PocketBase throws 404 when no record matches — translate to null.
		return null;
	}
}

/**
 * Upserts the owner's own requirements row. Creates it on first save, updates it
 * thereafter (one row per owner, enforced by a unique index on `owner`); a lost
 * create race is retried as an update by the shared helper.
 */
export async function upsertOwnerRequirements(
	pb: PocketBase,
	ownerId: string,
	data: Partial<Record<RequirementField, boolean>>
): Promise<void> {
	await upsertSingletonRow({
		pb,
		collection: 'lending_requirements',
		find: () => getOwnerRequirements(pb, ownerId),
		createData: { owner: ownerId, ...data },
		patch: data,
	});
}

/**
 * Evaluates the owner's enabled requirements against a borrower and returns the
 * ones that are NOT met (empty array = borrower may request). Used for UX only;
 * the backend hook performs the binding check.
 *
 * `requestKey` is forwarded to `getOwnerRequirements` and MUST be distinct per
 * concurrent call site on the same `pb` — see that function's doc comment. Note
 * that a `RequirementDef.evaluate` issuing its own reads is subject to the same
 * trap and must key them itself.
 */
export async function evaluateUnmetRequirements(
	pb: PocketBase,
	ownerId: string,
	borrower: Borrower,
	requestKey?: string
): Promise<UnmetRequirement[]> {
	const req = await getOwnerRequirements(pb, ownerId, requestKey);
	if (!req) return [];

	const unmet: UnmetRequirement[] = [];
	for (const def of requirementRegistry) {
		if (!def.isEnabled(req)) continue;
		const met = await def.evaluate({ pb, ownerId, borrower });
		if (!met) {
			unmet.push({
				key: def.key,
				actionLabel: def.actionLabel,
				actionHref: def.actionHref
			});
		}
	}
	return unmet;
}
