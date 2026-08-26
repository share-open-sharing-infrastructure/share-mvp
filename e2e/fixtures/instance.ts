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

/**
 * Class D (share-mvp#631) — deliberately DUMMY hosts, not the real production Tally/Keila
 * values: pinning these into `webServer.env` below is strictly better than the pre-#631 status
 * quo, where every e2e/CI run loaded the real `tally.so` unconditionally. `onboarding.spec.ts`
 * (survey step) and `email-case-insensitive.spec.ts` (newsletter checkbox) both need the survey
 * step / newsletter opt-in to exist, so both vars stay set for the whole e2e run rather than
 * per-spec.
 */
export const SURVEY_URL = 'https://survey.example.org/embed/e2e?dynamicHeight=1';
export const NEWSLETTER_FORM_URL = 'https://newsletter.example.org/forms/e2e';
