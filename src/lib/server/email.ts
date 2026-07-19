/**
 * Normalize a user-typed email before it goes to PocketBase (or any email lookup).
 *
 * PocketBase matches `users.email` case-sensitively and does NOT normalize on
 * save (issue #557): a mixed-case registration such as `Julika7@…` becomes an
 * account that a later lowercase login or password-reset lookup can never reach.
 * Trimming + lowercasing at every user-email boundary keeps the stored form and
 * every subsequent lookup in the same case. Use this at every place where a
 * user-typed email reaches PocketBase (register, login, reset, email change).
 */
export function normalizeEmail(email: string): string {
	// Assumption: ASCII local-parts. For IDN/Unicode local-parts with
	// locale-sensitive casing, V8 (this frontend) and PocketBase's goja runtime
	// (backend hook `pb_hooks/utils/email.js`) could in theory diverge on
	// `toLowerCase()`. The two sides MUST apply the same normalization for the
	// lookup to match — keep this in sync with the backend helper.
	return email.trim().toLowerCase();
}
