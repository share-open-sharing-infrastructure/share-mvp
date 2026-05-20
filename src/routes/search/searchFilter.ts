export function buildSearchFilter(raw: string): string | null {
	if (!raw || raw === '*') return null;
	const tokens = raw.trim().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return null;
	return tokens
		.map((token) => {
			const safe = token.replace(/"/g, '\\"');
			return `(name ~ "${safe}" || description ~ "${safe}")`;
		})
		.join(' && ');
}
