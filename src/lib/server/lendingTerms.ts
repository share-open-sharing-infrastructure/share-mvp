import type PocketBase from 'pocketbase';
import type { LendingTerms, TermAcceptance } from '$lib/types/models';

/**
 * Normalises HTML coming from PocketBase's richtext editor for display.
 *
 * The editor stores well-formed HTML but adds some annotations that don't sit
 * well in our theme (inline dark-mode colours) and occasionally leaves markdown
 * fragments unconverted (e.g. `## Heading` inside a `<div>`, or `[text](url)`
 * link patterns wrapped in styled spans). This helper makes the output legible
 * inside our prose styles. It is intentionally conservative — no real sanitizer,
 * because the source is admin-only (institution accounts via the PB admin UI).
 *
 * The cleaned form is what we render to the user AND what we snapshot into
 * `term_acceptances.termsBody`, so that what was shown == what was accepted.
 */
export function cleanTermsHtml(raw: string | undefined | null): string {
	if (!raw) return '';
	let html = raw;

	// Strip inline style attributes (PB editor injects dark-mode colour hints
	// that clash with our light/dark theme). Both quote styles handled.
	html = html.replace(/\s+style="[^"]*"/gi, '');
	html = html.replace(/\s+style='[^']*'/gi, '');

	// Unwrap inline spans that lost their styling and now only add noise.
	html = html.replace(/<span>\s*([\s\S]*?)\s*<\/span>/gi, '$1');

	// Convert leftover markdown link pattern  [label](url)  → real <a> tag.
	// Done after style stripping so any spans inside have already been unwrapped.
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

	// Convert markdown-style headings stored as plain text inside <div> blocks:
	//   <div>## Heading</div>  →  <h3>Heading</h3>
	//   <div># Heading</div>   →  <h2>Heading</h2>
	html = html.replace(/<div>\s*###\s+([^<]+?)\s*<\/div>/gi, '<h4>$1</h4>');
	html = html.replace(/<div>\s*##\s+([^<]+?)\s*<\/div>/gi, '<h3>$1</h3>');
	html = html.replace(/<div>\s*#\s+([^<]+?)\s*<\/div>/gi, '<h2>$1</h2>');

	// Collapse standalone `<br>` between block-level elements — the prose
	// styles already produce vertical rhythm between divs/paragraphs.
	html = html.replace(/(<\/(?:div|h\d|p|li|ul|ol)>)\s*<br\s*\/?>\s*/gi, '$1');

	return html.trim();
}

/**
 * Returns the currently active `lending_terms` record for the given owner (institution),
 * or `null` if the owner has no active terms.
 *
 * Active = `active == true`. We additionally require `effectiveFrom <= now` so that
 * future-dated versions can be staged without going live.
 */
export async function getActiveTerms(
	pb: PocketBase,
	ownerId: string
): Promise<LendingTerms | null> {
	try {
		const nowIso = new Date().toISOString().replace('T', ' ').replace('Z', '');
		return await pb.collection('lending_terms').getFirstListItem<LendingTerms>(
			pb.filter('owner = {:ownerId} && active = true && effectiveFrom <= {:nowIso}', {
				ownerId,
				nowIso,
			}),
			{ sort: '-effectiveFrom' }
		);
	} catch {
		// PocketBase throws 404 if no record matches — translate to null.
		return null;
	}
}

/**
 * Returns the most recent acceptance by `userId` of the given `termsId`, or `null`
 * if the user has not yet accepted that exact version.
 */
export async function getAcceptance(
	pb: PocketBase,
	userId: string,
	termsId: string
): Promise<TermAcceptance | null> {
	try {
		return await pb.collection('term_acceptances').getFirstListItem<TermAcceptance>(
			pb.filter('user = {:userId} && terms = {:termsId}', { userId, termsId }),
			{ sort: '-acceptedAt' }
		);
	} catch {
		return null;
	}
}

/**
 * Convenience: true if the user has already accepted the currently active terms
 * of the given owner. Returns false if there are no active terms (no gating needed).
 */
export async function hasAcceptedActiveTerms(
	pb: PocketBase,
	userId: string,
	ownerId: string
): Promise<boolean> {
	const active = await getActiveTerms(pb, ownerId);
	if (!active) return true; // no terms → nothing to accept → consider satisfied
	const acceptance = await getAcceptance(pb, userId, active.id);
	return acceptance !== null;
}
