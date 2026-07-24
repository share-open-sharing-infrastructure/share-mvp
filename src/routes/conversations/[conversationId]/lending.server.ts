import type PocketBase from 'pocketbase';
import type { ClientResponseError } from 'pocketbase';
import { fail } from '@sveltejs/kit';
import type { NotificationType } from '$lib/types/models.js';
import {
	isLendingStatusIn,
	LENDING_TRANSITIONS,
	type LendingAction,
	type LendingStatus,
} from '$lib/lending';
import { texts } from '$lib/texts';
import { notifyAndPush } from '$lib/server/notifications.js';

const PERCENTAGE_OF_USERS_ASKED = 0.33;

export function shouldAskCounterfactual(rng: () => number = Math.random): boolean {
	return rng() < PERCENTAGE_OF_USERS_ASKED;
}

/** Convenience alias for the return type of SvelteKit's `fail()`. */
type FailResult = ReturnType<typeof fail>;

/**
 * Loads a conversation and guards against the two most common action errors:
 * wrong caller role (403) and wrong lending state (400).
 *
 * Returns `{ conv }` on success or `{ error }` with a ready-to-return `fail()` value.
 * `conv` is a raw PocketBase record — fields are accessed by string key because
 * PocketBase's SDK returns untyped plain objects.
 */
async function loadAndValidateConversation(
	pb: PocketBase,
	conversationId: string,
	userId: string,
	requiredRole: 'owner' | 'requester' | 'participant',
	requiredStatus: LendingStatus | readonly LendingStatus[]
): Promise<{ conv: Record<string, unknown> } | { error: FailResult }> {
	let conversation: Record<string, unknown>;
	try {
		conversation = await pb.collection('conversations').getOne(conversationId);
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return { error: fail(e.status ?? 500, { fail: true, message: texts.lending.errors.notFound }) };
	}
	// `participant` passes for either side of the conversation; the role-specific
	// checks pin exactly one side.
	const isParticipant = conversation.itemOwner === userId || conversation.requester === userId;
	const roleOk =
		requiredRole === 'participant'
			? isParticipant
			: conversation[requiredRole === 'owner' ? 'itemOwner' : 'requester'] === userId;
	if (!roleOk) return { error: fail(403, { fail: true, message: texts.lending.errors.noPermission }) };
	const validStatuses: readonly LendingStatus[] =
		typeof requiredStatus === 'string' ? [requiredStatus] : requiredStatus;
	if (!isLendingStatusIn(validStatuses, conversation.lendingStatus)) return { error: fail(400, { fail: true, message: texts.lending.errors.invalidState }) };
	return { conv: conversation };
}

/** Fetches an item's display name, falling back gracefully if the item can't be loaded. */
async function getItemName(pb: PocketBase, itemId: string): Promise<string> {
	try {
		const item = await pb.collection('items').getOne(itemId);
		return item.name ?? texts.pages.itemDetail.unknownItem;
	} catch {
		return texts.pages.itemDetail.unknownItem;
	}
}

/** Everything a `TRANSITION_EFFECTS` entry needs to compute its side effects. */
interface EffectContext {
	pb: PocketBase;
	conversationId: string;
	conv: Record<string, unknown>;
	userId: string;
	itemName: string;
	/** Set only for `requestReturn`, the sole transition that needs extra caller data. */
	requesterName?: string;
}

interface TransitionEffect {
	/** Extra fields merged into the `conversations.update()` patch alongside `{ lendingStatus }`. */
	conversationPatch?: (ctx: EffectContext) => Record<string, unknown>;
	/** Item-side patch to apply after the conversation write succeeds, if any. */
	itemPatch?: (ctx: EffectContext) => Record<string, unknown> | null;
	/** Who gets notified, with what type/body. */
	notify: (ctx: EffectContext) => { recipientId: string; type: NotificationType; body: string };
	/** Runs after the core transition + notification succeed (failures here are logged, not fatal). */
	after?: (ctx: EffectContext) => Promise<void>;
}

/**
 * Per-action side effects, keyed the same as `$lib/lending.ts`'s `LENDING_TRANSITIONS` (which
 * supplies the role/state guard). `executeLendingTransition()` below is the single function
 * that drives conversation update + item update + notification + after-effect for all 6
 * actions from this table, replacing 6 near-identical try/catch/update blocks.
 */
const TRANSITION_EFFECTS: Record<LendingAction, TransitionEffect> = {
	acceptRequest: {
		itemPatch: () => ({ status: 'unavailable' }),
		notify: (ctx) => ({
			recipientId: ctx.conv.requester as string,
			type: 'request_accepted',
			body: texts.notifications.requestAccepted(ctx.itemName),
		}),
		// Only one borrower can proceed — auto-reject every other still-pending request
		// for the same item. Best-effort: a failure here is logged, not surfaced as a
		// failed accept (the accept itself already succeeded).
		after: async (ctx) => {
			try {
				const otherPending = await ctx.pb.collection('conversations').getFullList({
					filter: ctx.pb.filter(
						'requestedItem={:requestedItem} && lendingStatus="pending" && id!={:conversationId}',
						{ requestedItem: ctx.conv.requestedItem, conversationId: ctx.conversationId }
					),
				});
				await Promise.all(
					otherPending.map(async (other) => {
						await ctx.pb.collection('conversations').update(other.id, { lendingStatus: 'rejected' });
						await notifyAndPush(ctx.pb, {
							recipient: other.requester,
							sender: ctx.userId,
							type: 'request_rejected',
							relatedId: other.id,
							body: texts.notifications.requestRejected(ctx.itemName),
						});
					})
				);
			} catch (err) {
				console.error('Failed to auto-reject other pending conversations:', err);
			}
		},
	},

	rejectRequest: {
		notify: (ctx) => ({
			recipientId: ctx.conv.requester as string,
			type: 'request_rejected',
			body: texts.notifications.requestRejected(ctx.itemName),
		}),
	},

	// The requested item is NOT touched here: on `accepted → aborted` the backend
	// `lending.pb.js` hook resets it to `available` in an elevated transaction (the
	// aborting party may be the non-owner requester). The counterparty is notified
	// neutrally — the notification does not name who aborted.
	abortRequest: {
		notify: (ctx) => {
			const counterpartyId = (ctx.conv.requester === ctx.userId ? ctx.conv.itemOwner : ctx.conv.requester) as string;
			return { recipientId: counterpartyId, type: 'request_aborted', body: texts.notifications.requestAborted(ctx.itemName) };
		},
	},

	confirmHandover: {
		notify: (ctx) => ({
			recipientId: ctx.conv.requester as string,
			type: 'handover_confirmed',
			body: texts.notifications.handoverConfirmed(ctx.itemName),
		}),
	},

	requestReturn: {
		notify: (ctx) => ({
			recipientId: ctx.conv.itemOwner as string,
			type: 'return_requested',
			body: texts.notifications.returnRequested(ctx.requesterName ?? '', ctx.itemName),
		}),
	},

	confirmReturn: {
		conversationPatch: () => (shouldAskCounterfactual() ? { counterfactual: 'pending' } : {}),
		itemPatch: () => ({ status: 'available' }),
		notify: (ctx) => ({
			recipientId: ctx.conv.requester as string,
			type: 'return_confirmed',
			body: texts.notifications.returnConfirmed(ctx.itemName),
		}),
	},
};

/**
 * Runs a lending state transition end-to-end: role/state guard (via
 * `loadAndValidateConversation`, using `LENDING_TRANSITIONS[action]`), the conversation +
 * optional item update (via `TRANSITION_EFFECTS[action]`), the notification, and any
 * after-effect. Every one of the 6 exported transition functions below is a thin wrapper
 * around this.
 */
async function executeLendingTransition(
	pb: PocketBase,
	action: LendingAction,
	conversationId: string,
	userId: string,
	requesterName?: string
): Promise<FailResult | void> {
	const transition = LENDING_TRANSITIONS[action];
	const result = await loadAndValidateConversation(pb, conversationId, userId, transition.role, transition.from);
	if ('error' in result) return result.error;
	const { conv } = result;

	const itemName = await getItemName(pb, conv.requestedItem as string);
	const effect = TRANSITION_EFFECTS[action];
	const ctx: EffectContext = { pb, conversationId, conv, userId, itemName, requesterName };

	try {
		const extraPatch = effect.conversationPatch?.(ctx) ?? {};
		await pb.collection('conversations').update(conversationId, { lendingStatus: transition.to, ...extraPatch });
		// NOT atomic: for acceptRequest/confirmReturn this is a conversation write followed by
		// a separate item write — if the item update fails after the conversation update
		// already succeeded, the two can end up out of sync (e.g. status 'accepted' but the
		// item still 'available'). Fixing this needs a backend transaction (PocketBase hook
		// running both writes in `$app.runInTransaction`); out of scope for this refactor.
		const itemPatch = effect.itemPatch?.(ctx);
		if (itemPatch) await pb.collection('items').update(conv.requestedItem as string, itemPatch);
	} catch (err) {
		const e = err as Partial<ClientResponseError>;
		return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
	}

	const { recipientId, type, body } = effect.notify(ctx);
	await notifyAndPush(pb, { recipient: recipientId, sender: userId, type, relatedId: conversationId, body });

	if (effect.after) await effect.after(ctx);
}

/**
 * State transition: `pending` → `accepted` (called by item owner).
 * Marks the item unavailable and auto-rejects all other pending conversations
 * for the same item so only one borrower can proceed.
 */
export async function acceptRequest(pb: PocketBase, conversationId: string, userId: string): Promise<FailResult | void> {
	return executeLendingTransition(pb, 'acceptRequest', conversationId, userId);
}

/** State transition: `pending` → `rejected` (called by item owner). */
export async function rejectRequest(pb: PocketBase, conversationId: string, userId: string): Promise<FailResult | void> {
	return executeLendingTransition(pb, 'rejectRequest', conversationId, userId);
}

/**
 * State transition: `pending` | `accepted` → `aborted` (called by EITHER party).
 * See `TRANSITION_EFFECTS.abortRequest` for why the item is intentionally left untouched.
 */
export async function abortRequest(pb: PocketBase, conversationId: string, userId: string): Promise<FailResult | void> {
	return executeLendingTransition(pb, 'abortRequest', conversationId, userId);
}

/** State transition: `accepted` → `active` (called by item owner after physical handover). */
export async function confirmHandover(pb: PocketBase, conversationId: string, userId: string): Promise<FailResult | void> {
	return executeLendingTransition(pb, 'confirmHandover', conversationId, userId);
}

/** State transition: `active` → `return_requested` (called by the borrower). */
export async function requestReturn(
	pb: PocketBase,
	conversationId: string,
	userId: string,
	requesterName: string
): Promise<FailResult | void> {
	return executeLendingTransition(pb, 'requestReturn', conversationId, userId, requesterName);
}

/**
 * State transition: `active` | `return_requested` → `completed` (called by item owner).
 * Marks the item available again so it can receive new requests.
 */
export async function confirmReturn(pb: PocketBase, conversationId: string, userId: string): Promise<FailResult | void> {
	return executeLendingTransition(pb, 'confirmReturn', conversationId, userId);
}
