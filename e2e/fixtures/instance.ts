/**
 * Instance values the e2e specs assert against.
 *
 * Duplicated from `$lib/instance.ts`'s defaults rather than imported: e2e specs run outside
 * the Vite/SvelteKit `$lib` alias resolution the unit tests get, and the e2e dev server
 * (`playwright.config.ts` → webServer) starts with no `PUBLIC_*` overrides, so the defaults
 * are what the app actually serves. Kept here, not inline per spec, so there is one place to
 * change when the reference instance changes.
 */

/** `instance.city` default — see `$lib/instance.ts`. */
export const CITY = 'Lüneburg';

/** `instance.origin` default (`DEFAULT_ORIGIN`) — see `$lib/instance.ts`. */
export const ORIGIN = 'https://allerleih.org';
