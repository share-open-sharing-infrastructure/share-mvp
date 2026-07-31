/**
 * Instance values the e2e specs assert against.
 *
 * Duplicated from `$lib/instance.ts`'s defaults rather than imported: e2e specs run outside
 * the Vite/SvelteKit `$lib` alias resolution the unit tests get. `playwright.config.ts` imports
 * these same constants and pins them into the e2e dev server's `webServer.env` (`PUBLIC_INSTANCE_CITY`
 * / `PUBLIC_SITE_ORIGIN`), so the values here don't just describe the app's defaults — they drive
 * what the dev server actually serves, overriding any `PUBLIC_*` a developer's local `.env` sets
 * for their own multi-city work. Kept here, not inline per spec, so there is one place to change
 * when the reference instance changes.
 */

/** `instance.city` default — see `$lib/instance.ts`. */
export const CITY = 'Lüneburg';

/** `instance.origin` default (`DEFAULT_ORIGIN`) — see `$lib/instance.ts`. */
export const ORIGIN = 'https://allerleih.org';
