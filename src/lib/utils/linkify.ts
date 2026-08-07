/**
 * Split a plain-text item description into text and link segments for safe rendering.
 *
 * Only `http(s)://…` URLs become links: the match is scheme-safe by construction, so
 * `javascript:` / `data:` payloads and scheme-less `www.…` are deliberately left as text and
 * can never become an `href`. Nothing here produces HTML — the consuming component renders
 * text segments as escaped text and link segments as attribute-bound `<a>` elements, so there
 * is no `{@html}` / XSS surface. Storage stays plain text; this only affects rendering.
 */

export type DescriptionSegment =
	| { type: 'text'; text: string }
	| { type: 'link'; url: string };

/** Prose punctuation that commonly trails a URL and should not be part of the link. */
const TRAILING_PUNCTUATION = new Set([
	'.',
	',',
	';',
	':',
	'!',
	'?',
	'"',
	"'",
	'»',
	')',
]);

/**
 * Turn plain text into an ordered list of text/link segments. `http(s)://` URLs (scheme match
 * is case-insensitive) become link segments; everything else — including newlines, which the
 * caller preserves via `whitespace-pre-line` — stays in text segments.
 *
 * Trailing prose punctuation (`.,;:!?"'»)`) is trimmed off the URL and folded back into the
 * following text, except a closing `)` that balances an opening `(` inside the URL itself
 * (e.g. `…/Drill_(tool)` Wikipedia paths), which stays part of the link.
 */
export function linkifySegments(text: string): DescriptionSegment[] {
	const segments: DescriptionSegment[] = [];
	const re = /https?:\/\/\S+/gi;
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = re.exec(text)) !== null) {
		let url = match[0];

		// Trim trailing prose punctuation off the URL. A closing ")" is kept only when the URL
		// itself contains a matching "(", otherwise it is treated as sentence punctuation.
		while (url.length > 0) {
			const last = url[url.length - 1];
			if (!TRAILING_PUNCTUATION.has(last)) break;
			if (last === ')') {
				const opens = (url.match(/\(/g) ?? []).length;
				const closes = (url.match(/\)/g) ?? []).length;
				if (closes <= opens) break;
			}
			url = url.slice(0, -1);
		}

		const start = match.index;
		if (start > lastIndex) {
			segments.push({ type: 'text', text: text.slice(lastIndex, start) });
		}
		segments.push({ type: 'link', url });

		// Continue scanning right after the (possibly trimmed) URL. The trimmed trailing
		// punctuation is left in the stream and re-emitted as text — it can never start a new
		// `https?://` match, so this cannot loop.
		lastIndex = start + url.length;
		re.lastIndex = lastIndex;
	}

	if (lastIndex < text.length) {
		segments.push({ type: 'text', text: text.slice(lastIndex) });
	}

	return segments;
}
