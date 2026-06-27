import type { LegalDocType } from '$lib/legal';

/**
 * Platform legal-consent helpers (Issue #399).
 *
 * The hot-path gate (`hooks.server.ts`) decides from the already-loaded auth
 * record's version cache (`tosAcceptedVersion` / `privacyAcceptedVersion` /
 * `legalLocked`) compared against the currently-active versions (read via
 * `$lib/server/legalDocs`). The cache fields and the lock are server-only (set by
 * the `legal.pb.js` backend hooks), and acceptances/declines are written there in
 * superuser context — see that file. This module is pure (no DB writes), so the
 * frontend can never set consent state under the user's own auth (review #1/#2).
 */

/** Minimal shape of the fields this module reads off the auth record. */
export interface LegalUser {
	id: string;
	tosAcceptedVersion?: string;
	privacyAcceptedVersion?: string;
	legalLocked?: boolean;
	[key: string]: unknown;
}

export interface OutstandingDoc {
	docType: LegalDocType;
	version: string;
}

const DOC_TYPES: LegalDocType[] = ['tos', 'privacy'];

/** The cache field on the user record that mirrors the accepted version per doc. */
function versionField(docType: LegalDocType): 'tosAcceptedVersion' | 'privacyAcceptedVersion' {
	return docType === 'tos' ? 'tosAcceptedVersion' : 'privacyAcceptedVersion';
}

/** True if the user declined the current terms and is awaiting re-consent. */
export function isLegalLocked(user: Pick<LegalUser, 'legalLocked'> | null | undefined): boolean {
	return !!user?.legalLocked;
}

/**
 * Returns the active documents whose current version this user has NOT yet
 * accepted, given the active versions (`{ tos: '1.3', privacy: '2.9' }`) read from
 * the `legal_documents` collection. A docType missing from `activeVersions` (no
 * active document configured) is not enforced. Empty array ⇒ fully consented.
 */
export function getOutstandingLegalDocs(
	user: LegalUser | null | undefined,
	activeVersions: Record<string, string>
): OutstandingDoc[] {
	if (!user) return [];
	const outstanding: OutstandingDoc[] = [];
	for (const docType of DOC_TYPES) {
		const active = activeVersions[docType];
		if (!active) continue;
		if (user[versionField(docType)] !== active) {
			outstanding.push({ docType, version: active });
		}
	}
	return outstanding;
}
