/**
 * Instance configuration (issue #473, extended by #629/#646): ONE source for everything that
 * differs between AllerLeih instances (city, origin, contact addresses, imprint, social/project
 * links, FAQ prose, team) — instead of scattered literals ("allerleih.org", "Lüneburg") across
 * routes and components. `texts.ts` interpolates the German copy from this; code reads
 * URLs/emails directly from here. **The flagship instance** is allerleih.org itself — the one
 * instance whose operator data may fall back to the code defaults in `$lib/instanceDefaults.ts`
 * instead of requiring env vars. `isFlagshipOrigin()` is the single source of truth for "is this
 * the flagship"; the module-scope `FLAGSHIP` const below decides which default applies. Pure
 * origin/analytics validation lives in `$lib/instanceResolvers.ts` (split out for
 * unit-testability without env mocking — see its own header); this file's job is reading
 * `$env/dynamic/public`, applying the flagship/Class A/B/C gating below, and assembling `instance`.
 *
 * Every instance-branding value below is commented with its class: **Class A** (required on a
 * non-flagship instance, else the server refuses to start — `missingInstanceEnv()` in
 * `$lib/server/env.ts`, since a §5 TMG imprint is legally mandatory), **Class B** (optional,
 * unset ⇒ `''` on a non-flagship instance — render sites wrap these in `{#if}`), **Class C**
 * (`PUBLIC_GITHUB_URL` only — defaults unconditionally, still overridable for a fork), or
 * **Class D — opt-in third-party data sinks** (`onboardingSurvey`, `newsletterFormUrl`;
 * share-mvp#631). Class D is optional on **every** instance, flagship included, and — unlike A/B/C
 * — is deliberately **NOT** routed through `flagshipValue()`/`FLAGSHIP_*` in
 * `$lib/instanceDefaults.ts`: a forgotten env var on a Class-A/B/C field degrades to "no imprint
 * link" (safe), but a forgotten Class-D var falling back to a default would silently pipe a
 * self-hoster's users' survey answers or email signups into the flagship's OWN Tally/Keila
 * account — the exact opposite failure mode, and a data-protection incident rather than a
 * cosmetic gap. Empty/invalid ⇒ the feature doesn't exist: the render site vanishes, the route
 * 404s, and no request ever reaches the third party. `PUBLIC_ANALYTICS_ORIGIN`/`WEBSITE_ID`
 * (`analytics` below) are Class D too, for the same reason — they only look like a plain optional
 * value because they predate this naming.
 *
 * `$env/dynamic/*` is the **repo-wide** convention since #627 (`$env/static/*` is ESLint-banned):
 * one build artifact serves N instances, so `adapter-node` reads `process.env` at runtime, not
 * build time. `PUBLIC_PB_URL`/`PUBLIC_VAPID_PUBLIC_KEY` come from `$lib/publicEnv.ts` instead;
 * which vars MUST be present at startup is documented in `$lib/server/env.ts`.
 *
 * Safety notes: the top-level evaluation runs once on first import (SvelteKit calls
 * `set_public_env()` before any hook/route runs — re-verify this assumption if the adapter is
 * ever changed away from adapter-node). NEVER import this (or `$lib/texts`/`$lib/publicEnv.ts`)
 * from `src/service-worker.ts` — `$env/dynamic/public` is a hard error there. No `import { dev }`
 * / `browser` / `building` here — this module is client-reachable, so a dev-only branch would be
 * an SSR/hydration divergence; that split lives in `src/hooks.server.ts`'s `init` hook instead
 * (hard failure in prod, `console.warn` in dev), never here.
 *
 * Never `throw` directly: an error here would take down the whole app with a 500 — invalid or
 * missing values fall back to a safe default instead (a flagship literal, or `''`). Whether a
 * non-flagship instance is ALLOWED to be missing a Class-A value is enforced earlier, in the
 * `init` hook — by the time this module runs, that gate has already passed.
 */
import { env } from '$env/dynamic/public';
import {
	resolveOrigin,
	isFlagshipOrigin,
	resolveAnalytics,
	resolveExternalFormUrl,
	resolveOnboardingSurvey,
	SCRIPT_ORIGIN_PATTERN,
	WEBSITE_ID_PATTERN,
	type InstanceAnalytics,
	type InstanceSurvey,
} from './instanceResolvers';
import {
	FLAGSHIP_CITY,
	FLAGSHIP_CONTACT_EMAIL,
	FLAGSHIP_CONTRIBUTE_URL,
	FLAGSHIP_FEEDBACK_EMAIL,
	FLAGSHIP_FOUNDER_INTRO,
	FLAGSHIP_IMPRINT,
	FLAGSHIP_SOCIAL,
	FLAGSHIP_TEAM,
	UPSTREAM_REPO,
} from './instanceDefaults';

export interface InstanceSocial {
	telegram: string;
	mastodon: string;
	pixelfed: string;
	instagram: string;
}

/** Project-wide links. `github` is Class C (unconditional default); `contributeBoard` is Class B. */
export interface InstanceLinks {
	github: string;
	contributeBoard: string;
}

/**
 * Operator's postal address (§5 TMG). `operator`/`street`/`postalCode`/`city`/`country` are
 * Class A; `representative`/`registerEntry` (§5 Nr. 4 TMG, moved up from `legal` in #629) are
 * Class B. `legal.*` is generic, non-flagship placeholder guidance for fields that only apply to
 * SOME operators — NOT env-fed, identical everywhere.
 */
export interface InstanceImprint {
	operator: string;
	representative: string;
	street: string;
	postalCode: string;
	city: string;
	country: string;
	registerEntry: string;
	legal: {
		supervisoryAuthority: string;
		professionalRegulation: string;
		vatId: string;
		disputeResolution: string;
		management: string;
	}
}

export interface InstanceFaqItem {
	q: string;
	a: string;
}

export interface InstanceTeamMember {
	id: number;
	linkedIn: string;
	gitHub: string;
	src: string;
	alt: string;
	name: string;
	jobTitle: string;
	description: string;
}

export type { InstanceAnalytics, InstanceSurvey };

export interface InstanceConfig {
	/** Without trailing slash. */
	readonly origin: string;
	/** Derived via `new URL(origin).hostname`. */
	readonly originHost: string;
	readonly city: string;
	readonly appName: string;
	readonly contactEmail: string;
	readonly feedbackEmail: string;
	readonly social: InstanceSocial;
	readonly links: InstanceLinks;
	readonly imprint: InstanceImprint;
	readonly analytics: InstanceAnalytics;
	/** Class D — see header. `url` empty ⇒ the onboarding survey step doesn't exist. */
	readonly onboardingSurvey: InstanceSurvey;
	/** Class D — see header. `''` ⇒ `/misc/newsletter` 404s, every newsletter link/checkbox hides. */
	readonly newsletterFormUrl: string;
	/**
	 * Instance-specific PROSE — the counterpart to the scalar fields above. Demarcation rule:
	 * would this text's WORDING (not just a variable within it) change if AllerLeih restarted in
	 * a different city with a new team? If not, it belongs in `texts.ts` instead, parameterized.
	 */
	readonly faq: { faqItems: readonly InstanceFaqItem[] };
	/** The "/misc/about" team roster — real people, so it changes with the instance/team. */
	readonly team: readonly InstanceTeamMember[];
}

const { origin, originHost } = resolveOrigin(env.PUBLIC_SITE_ORIGIN);
// Which flagship-scoped default applies below (see header + `isFlagshipOrigin()`). Never
// re-evaluated, not exported as a value — env.ts calls the predicate function independently.
const FLAGSHIP = isFlagshipOrigin(env.PUBLIC_SITE_ORIGIN);
// Hoisted so the `faq` prose below can interpolate it — the object literal can't self-reference
// its own `appName` field via `this`.
const APP_NAME = env.PUBLIC_APP_NAME?.trim() || 'AllerLeih';

/**
 * The repeated Class A/B pattern (`env.X?.trim() || (FLAGSHIP ? fallback : '')`) factored into
 * one place: with 14+ call sites below repeating it inline, the 15th field forgetting the
 * `FLAGSHIP` gate or the `.trim()` was the realistic failure mode this closes off. Closes over
 * the module-scope `FLAGSHIP` above rather than taking it as a parameter — every call site here
 * already has it in scope, and threading it through as an argument would just repeat it at every
 * call site for no benefit. Class C (`links.github`) is NOT routed through this — it defaults
 * unconditionally, flagship or not, so it stays a plain `||` at its own call site.
 */
function flagshipValue(raw: string | undefined, fallback: string): string {
	return raw?.trim() || (FLAGSHIP ? fallback : '');
}

export const instance: InstanceConfig = {
	origin,
	originHost,
	city: flagshipValue(env.PUBLIC_INSTANCE_CITY, FLAGSHIP_CITY), // Class A
	appName: APP_NAME, // Partial (issue #473): renames this value only, not the ~89 "AllerLeih" copy occurrences/assets.
	contactEmail: flagshipValue(env.PUBLIC_CONTACT_EMAIL, FLAGSHIP_CONTACT_EMAIL), // Class A
	// Only the flagship falls back to its OWN feedback address (Class B) — a self-hoster's
	// feedback silently landing in feedback@allerleih.org would be worse than no link (#646 F2).
	feedbackEmail: flagshipValue(env.PUBLIC_FEEDBACK_EMAIL, FLAGSHIP_FEEDBACK_EMAIL),
	social: {
		telegram: flagshipValue(env.PUBLIC_SOCIAL_TELEGRAM, FLAGSHIP_SOCIAL.telegram),
		mastodon: flagshipValue(env.PUBLIC_SOCIAL_MASTODON, FLAGSHIP_SOCIAL.mastodon),
		pixelfed: flagshipValue(env.PUBLIC_SOCIAL_PIXELFED, FLAGSHIP_SOCIAL.pixelfed),
		instagram: flagshipValue(env.PUBLIC_SOCIAL_INSTAGRAM, FLAGSHIP_SOCIAL.instagram),
	},
	links: {
		github: env.PUBLIC_GITHUB_URL?.trim() || UPSTREAM_REPO, // Class C — unconditional, never flagship-gated
		contributeBoard: flagshipValue(env.PUBLIC_CONTRIBUTE_URL, FLAGSHIP_CONTRIBUTE_URL), // Class B
	},
	imprint: {
		operator: flagshipValue(env.PUBLIC_IMPRINT_OPERATOR, FLAGSHIP_IMPRINT.operator), // Class A
		representative: flagshipValue(
			env.PUBLIC_IMPRINT_REPRESENTATIVE,
			FLAGSHIP_IMPRINT.representative
		), // Class B
		street: flagshipValue(env.PUBLIC_IMPRINT_STREET, FLAGSHIP_IMPRINT.street), // Class A
		postalCode: flagshipValue(env.PUBLIC_IMPRINT_POSTAL_CODE, FLAGSHIP_IMPRINT.postalCode), // Class A
		city: flagshipValue(env.PUBLIC_IMPRINT_CITY, FLAGSHIP_IMPRINT.city), // Class A
		country: flagshipValue(env.PUBLIC_IMPRINT_COUNTRY, FLAGSHIP_IMPRINT.country), // Class A
		registerEntry: flagshipValue(
			env.PUBLIC_IMPRINT_REGISTER_ENTRY,
			FLAGSHIP_IMPRINT.registerEntry
		), // Class B
		// Generic, non-flagship placeholder guidance — NOT env-fed, identical everywhere.
		legal: {
			supervisoryAuthority:
				'Zuständige Aufsichtsbehörde: Falls der Betreiber einer behördlichen Aufsicht unterliegt (z. B. Finanzdienstleister, Versicherungsvermittler).',
			professionalRegulation:
				'Berufsrechtliche Angaben: Für reglementierte Berufe wie Anwälte, Ärzte oder Steuerberater (Berufsbezeichnung, Kammer, berufsrechtliche Regelungen).',
			vatId: 'Umsatzsteuer-Identifikationsnummer (falls vorhanden): Nach § 27a UStG.',
			disputeResolution:
				'Hinweis auf die Online-Streitbeilegung (für Online-Shops): Link zur EU-Plattform zur Streitbeilegung.',
			management: 'GmbH & Co. KG, AG, UG: Angabe der Geschäftsführer oder Vorstandsmitglieder.',
		}
	},
	analytics: resolveAnalytics(env.PUBLIC_ANALYTICS_ORIGIN, env.PUBLIC_ANALYTICS_WEBSITE_ID),
	onboardingSurvey: resolveOnboardingSurvey(env.PUBLIC_ONBOARDING_SURVEY_URL),
	newsletterFormUrl: resolveExternalFormUrl(env.PUBLIC_NEWSLETTER_FORM_URL),
	faq: {
		faqItems: [
			{
				q: 'Wer seid ihr?',
				// Not APP_NAME-interpolated (like the founder intro it follows on the flagship)
				// — same static values paragraph on every instance, city/name notwithstanding.
				a:
					(FLAGSHIP ? `${FLAGSHIP_FOUNDER_INTRO} ` : '') +
					'Wir sind der Auffassung, dass das Teilen und Leihen in vielerlei Hinsicht eine bessere Alternative zum Kaufen ist. Und wir wollen, dass die Infrastruktur dafür nicht nur einfach und zugänglich ist, sondern auch nachhaltig für alle funktioniert. Deswegen entwickeln wir AllerLeih als Open-Source-Software. So verhindern wir die Kommerzialisierung und manipulative Algorithmen.',
			},
			{
				q: 'Was passiert, wenn etwas kaputt geht?',
				a: 'Wir bekommen die Frage häufiger und haben eine vielleicht etwas unbefriedigende Antwort: das, was sonst auch passieren würde. Wenn euer Gegenüber eine Haftpflicht hat, greift die. Oder ihr regelt das zwischen euch. Wir wollen bewusst keine Sozialtechnik wie Versicherungen oder Ähnliches anbieten, weil wir Vertrauen nicht outsourcen wollen. Über die Vertrauensfunktion habt ihr die volle Kontrolle darüber, an wen ihr verleiht. Wenn es doch einmal zu größeren Problemen kommt, meldet euch gerne und wir versuchen zu helfen!',
			},
			{
				q: 'Was kostet das?',
				a: `${APP_NAME} kostet dich als Privatperson nichts, und das wird auch so bleiben, denn ${APP_NAME} ist für alle! Die Finanzierung liegt beim Betreiber dieser Instanz, der aktiv nach Finanzierungsmöglichkeiten sucht. Falls ihr Ideen oder Kontakte habt, meldet euch gerne bei uns!`,
			},
			{
				q: 'Was habt ihr vor?',
				a: `${APP_NAME} für alle! Wir wollen ${APP_NAME} zu DER Plattform für das Teilen und Leihen machen. Im Gegensatz zu anderen Plattformen setzen wir dafür auf open-source und versuchen, ein dezentrales Modell zu entwickeln, das nicht von uns abhängt. In Zukunft soll also jeder Mensch in seiner Stadt, seinem Quartier oder seiner Kommune die Möglichkeit haben, eine eigene ${APP_NAME}-Instanz zu betreiben und sich vor Ort um die Community zu kümmern.`,
			},
			{
				q: 'Was passiert mit meinen Daten?',
				a: `Wir sind noch im Aufbau und es gibt noch Allerlei(h) zu tun, deswegen läuft hier vielleicht noch nicht alles 100% rund. Aber digitale Freiheitsrechte (Persönlichkeitsrecht, Datenschutz, Teilhabe) sind für uns unverhandelbare Grundwerte und wir werden ${APP_NAME} so entwickeln, dass ihr die volle Kontrolle über eure Daten habt. Zu jeder Zeit. Für immer. Das heißt: wir verkaufen keine Daten und schützen eure Daten bestmöglich — wo genau sie gespeichert werden und wie, erfährst du in unserer Datenschutzerklärung. Falls ihr feststellt, dass das nicht der Fall ist, meldet euch gerne sofort bei uns! Wir wollen transparent sein und Fehler schnellstmöglich beheben.`,
			},
		],
	},
	team: FLAGSHIP ? FLAGSHIP_TEAM : [],
};

/**
 * Builds an absolute, crawler-friendly URL from a root-absolute path (e.g. `'/misc/imprint'`).
 *
 * NEVER compose with `resolve()` (`$app/paths`): `svelte.config.js` has no `paths` block, so
 * SvelteKit's default `paths.relative: true` applies, and `resolve()` returns a
 * **page-relative** path under SSR (`'./'` for `/`, `'../misc/imprint'` for a nested route) —
 * `instanceUrl(resolve(...))` would produce broken `canonical`/`og:url` tags in the
 * server-rendered HTML (`https://allerleih.org../misc/imprint`), even though it looked correct
 * in the browser after hydration (issue #473, round 4). Always pass a literal root-absolute
 * path (or `page.url.pathname` from `$app/state`, see `SeoHead.svelte`).
 *
 * The DEV guard below makes a violation loud instead of silently wrong — no `throw`, because a
 * render error here would be worse than one wrong tag.
 */
export function instanceUrl(path: string): string {
	if (import.meta.env.DEV && !path.startsWith('/')) {
		console.error(
			`instanceUrl() expects a root-absolute path, got "${path}" — likely resolve() output ` +
				'concatenated directly with an origin (see comment above).'
		);
	}
	return `${instance.origin}${path}`;
}

/**
 * `<head>` snippet for Umami; `''` if analytics isn't configured/is invalid (see
 * `resolveAnalytics`). Byte-identical to the previous `src/app.html:13-14` when production
 * values are set. Pure formatter, kept separate from `analyticsHeadSnippet()` so tests can call
 * the `resolveAnalytics()` → snippet pipeline directly, without `vi.resetModules()` +
 * `vi.doMock()` + a dynamic re-import to inject env vars into the module singleton.
 *
 * Re-validates `scriptOrigin`/`websiteId` against the same patterns as `resolveAnalytics`
 * (imported from `$lib/instanceResolvers.ts`) instead of trusting the caller: `InstanceAnalytics`
 * is a plain data type (no branded/nominal typing), every caller here already passes validated
 * values, but the signature alone doesn't enforce that — the check is cheap and idempotent, so
 * better to redo it here.
 */
export function buildAnalyticsSnippet(analytics: InstanceAnalytics): string {
	if (!analytics.scriptOrigin || !analytics.websiteId) return '';
	if (!SCRIPT_ORIGIN_PATTERN.test(analytics.scriptOrigin)) return '';
	if (!WEBSITE_ID_PATTERN.test(analytics.websiteId)) return '';
	const { scriptOrigin, websiteId } = analytics;
	return (
		`<script defer src="${scriptOrigin}/script.js" data-website-id="${websiteId}"></script>\n` +
		`<script defer src="${scriptOrigin}/recorder.js" data-website-id="${websiteId}"></script>`
	);
}

/** Like {@link buildAnalyticsSnippet}, bound to the module singleton `instance.analytics`. */
export function analyticsHeadSnippet(): string {
	return buildAnalyticsSnippet(instance.analytics);
}
