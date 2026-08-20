/**
 * Public runtime configuration (issue #627). Read at **call time** from
 * `$env/dynamic/public`, so one build artefact serves any instance. SvelteKit populates the
 * dynamic env before hooks run and before any route module is imported, so a call-time read
 * always sees the value the running instance was started with.
 *
 * Client-safe: SvelteKit serialises the whole `PUBLIC_*` env into every rendered page and
 * exposes it to the browser bundle as `globalThis.__sveltekit_<hash>.env`. Treat *every*
 * `PUBLIC_*` var an operator sets as fully public, whether or not this module reads it.
 *
 * MUST NEVER be imported from `src/service-worker.ts` — same constraint as `$lib/instance.ts`
 * and `$lib/texts.ts`: a service worker has no page globals, so `$env/dynamic/public`
 * resolves to `undefined` there and the first property read throws. `eslint.config.js`
 * enforces this with a `no-restricted-imports` block scoped to that file.
 *
 * Both getters fall back to `''` rather than throwing: an error here would 500 the whole app.
 * `assertRequiredEnv()` in `$lib/server/env.ts` (called from the `init` server hook) is what
 * makes an empty value impossible in a real deployment.
 */
import { env } from '$env/dynamic/public';

/**
 * PocketBase base URL, **normalised to a trailing slash** — the single home for that invariant.
 * Every consumer concatenates (`` `${pbUrl()}api/files/…` ``), so a slash-less value would build
 * `http://host:8090api/files/…` and break every image on the site; the startup validator only
 * checks that the var is non-empty. Unset/empty stays `''` (never `'/'`).
 */
export function pbUrl(): string {
	const raw = env.PUBLIC_PB_URL;
	if (!raw) return '';
	return raw.endsWith('/') ? raw : `${raw}/`;
}

/** Web-Push VAPID public key (URL-safe base64, 65 bytes decoded). */
export function vapidPublicKey(): string {
	return env.PUBLIC_VAPID_PUBLIC_KEY ?? '';
}
