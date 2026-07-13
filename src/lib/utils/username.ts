// Shared username rules — single source of truth for client feedback (register /
// profile forms) and server-side validation, so the two can't drift. Kept out of
// $lib/server so it is importable from Svelte components. The backend enforces the
// same constraints on the `users.username` field (pattern + min/max).

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;

// Letters/word chars, plus internal spaces, dots and hyphens. No leading or trailing
// space (the last class excludes space); requires at least two chars, which the
// min-length check already guarantees.
export const USERNAME_REGEX = /^[\w\p{L}][\w\p{L} .-]*[\w\p{L}.-]$/u;

export type UsernameValidation = 'ok' | 'too_short' | 'too_long' | 'invalid';

export function normalizeUsername(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ');
}

export function validateUsername(raw: string): UsernameValidation {
	const value = normalizeUsername(raw);
	// Count Unicode code points, not UTF-16 units, to match PocketBase's `max`
	// (Go `len([]rune(value))`) — otherwise a name of supplementary-plane letters
	// would be rejected client-side while the backend accepts it.
	const length = [...value].length;
	if (length < USERNAME_MIN_LENGTH) return 'too_short';
	if (length > USERNAME_MAX_LENGTH) return 'too_long';
	if (!USERNAME_REGEX.test(value)) return 'invalid';
	return 'ok';
}
