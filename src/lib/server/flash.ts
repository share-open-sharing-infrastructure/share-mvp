import type { Cookies } from '@sveltejs/kit';

/**
 * Sets the post-redirect "flash" cookie (the universal flash pattern used by the
 * auth flows: confirm an action, set the flash, redirect to /auth/login).
 *
 * The envelope (cookie name, JSON shape, path, 60 s maxAge) is a cross-file
 * convention — every writer must produce exactly this form, which is why it lives
 * here instead of being copy-pasted per action.
 *
 * NOTE: as of the 2026-07 quality sweep nothing in src/ reads this cookie back —
 * the messages are written but never displayed. When a reader is added (e.g. on
 * the login page), match this envelope.
 */
export function setFlash(
	cookies: Cookies,
	message: string,
	type: 'success' | 'error' = 'success'
): void {
	cookies.set('flash', JSON.stringify({ type, message }), {
		path: '/',
		maxAge: 60, // seconds
	});
}
