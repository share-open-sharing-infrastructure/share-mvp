import type PocketBase from 'pocketbase';
import type { LegalDocType } from '$lib/legal';

/**
 * Reads the platform legal documents from the `legal_documents` collection
 * (Issue #399). This is the single source of truth for the text + current
 * version of each document; an operator edits the active row in the PB admin UI.
 * The active row per docType is world-readable (collection listRule `active = true`),
 * so unauthenticated `/misc/tos|privacy` can render it too.
 */

export interface LegalDoc {
	docType: LegalDocType;
	version: string;
	title: string;
	effectiveDate: string;
	body: string;
}

/** All currently-active documents (full body) — for rendering pages. */
export async function getActiveLegalDocs(pb: PocketBase): Promise<LegalDoc[]> {
	return pb.collection('legal_documents').getFullList<LegalDoc>({ filter: 'active = true' });
}

/** The active document for a single type, or null if none is configured. */
export async function getActiveLegalDoc(
	pb: PocketBase,
	docType: LegalDocType
): Promise<LegalDoc | null> {
	const docs = await getActiveLegalDocs(pb);
	return docs.find((d) => d.docType === docType) ?? null;
}

// The consent gate runs on (almost) every request, so avoid a DB round-trip per
// request: cache just the active version per docType in-process for a short TTL.
// Versions change only when an operator publishes a new document, so staleness up
// to TTL_MS is harmless (a freshly published version simply takes effect within a
// minute). Fail-open on read errors so a transient DB hiccup can't lock everyone
// out of the whole app.
const TTL_MS = 60_000;
let versionCache: { at: number; versions: Record<string, string> } | null = null;

export async function getActiveLegalVersions(
	pb: PocketBase,
	now: number = Date.now()
): Promise<Record<string, string>> {
	if (versionCache && now - versionCache.at < TTL_MS) return versionCache.versions;
	try {
		const items = await pb
			.collection('legal_documents')
			.getFullList<{ docType: string; version: string }>({
				filter: 'active = true',
				fields: 'docType,version'
			});
		const versions: Record<string, string> = {};
		for (const it of items) versions[it.docType] = it.version;
		versionCache = { at: now, versions };
		return versions;
	} catch {
		return versionCache?.versions ?? {};
	}
}

/** Test seam: drop the in-process version cache. */
export function _resetLegalVersionCache(): void {
	versionCache = null;
}
