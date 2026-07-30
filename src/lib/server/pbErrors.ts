import { fail } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';

/**
 * The standard form-action fallback for a thrown PocketBase error: translate it into
 * `fail(status, { fail: true, message })`, defaulting to the error's own HTTP status
 * (500 when absent) and the generic German error message.
 *
 * Replaces the identical catch-block previously copy-pasted across the /user routes —
 * a change to this fallback (logging, status-specific handling) now lands in one place.
 */
export function failFromPbError(err: unknown, message: string = texts.errors.somethingWentWrong) {
	const e = err as Partial<ClientResponseError>;
	return fail(e?.status ?? 500, { fail: true, message });
}
