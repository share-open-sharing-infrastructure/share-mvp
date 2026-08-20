/**
 * Instance configuration (issue #473): ONE source for everything that differs between
 * AllerLeih instances (city, origin, contact addresses, analytics) — instead of scattered
 * literals ("allerleih.org", "Lüneburg") across routes and components. `texts.ts` interpolates
 * the German copy strings from this (see there); code reads URLs/emails directly from here.
 *
 * Deliberate exception to the repo's `$env/static/*` convention: this file uses
 * `$env/dynamic/public`, because a single build artifact is meant to serve N city instances —
 * `adapter-node` reads environment variables from `process.env` at runtime, not at build time.
 * `$env/static/public` would bake the values into the build (one artifact per instance).
 * All 12 other `$env/static/*` imports in the repo remain unchanged — this is the only
 * place using `$env/dynamic/public`.
 *
 * Safety notes for maintainers:
 * (a) The top-level evaluation below (the module is evaluated once on first import) is safe,
 *     because SvelteKit calls `set_public_env()` before hooks (`get_hooks()`) and any lazily
 *     imported route module run — so the values are already available by the time this module
 *     is first imported. Re-verify this assumption if the adapter is ever changed away from
 *     adapter-node.
 * (b) `$lib/instance` (and therefore `$lib/texts`) must NEVER be imported from
 *     `src/service-worker.ts` — `$env/dynamic/public` is a hard error there (no request context).
 *
 * Never `throw` directly: an error here would take down the whole app with a 500. Invalid
 * values silently fall back to safe defaults (see `resolveOrigin`/`resolveAnalytics`).
 */
import { env } from '$env/dynamic/public';

export interface InstanceSocial {
	telegram: string;
	mastodon: string;
	pixelfed: string;
	instagram: string;
}

/** Project-wide links (operator-scoped, not city-specific — just deduplicated here). */
export interface InstanceLinks {
	github: string;
	contributeBoard: string;
}

/** Operator's postal address (§5 TMG) — operator-scoped, not city-specific. */
export interface InstanceImprint {
	operator: string;
	representative: string;
	street: string;
	postalCode: string;
	city: string;
	country: string;
	legal: {
		supervisoryAuthority: string;
		professionalRegulation: string;
		vatId: string;
		registerEntry: string;
		disputeResolution: string;
		management: string;
	}
}

/** Empty values ⇒ analytics fully off (opt-in, no fallback to a default instance). */
export interface InstanceAnalytics {
	scriptOrigin: string;
	websiteId: string;
}

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
}

const DEFAULT_ORIGIN = 'https://allerleih.org';
const DEFAULT_ORIGIN_HOST = 'allerleih.org';

/**
 * Host+port character set shared by every "operator-set origin" validated here:
 * `[A-Za-z0-9.-]`, optional `:port`. Not a standalone regex — just the common building block
 * that `SITE_ORIGIN_PATTERN`/`SCRIPT_ORIGIN_PATTERN` below build their strings from, so the
 * injection-guard character set lives in one place. The one deliberate difference between the
 * two (`http:` allowed vs. `https:` only) stays explicit at each usage site.
 */
const ORIGIN_HOST_PORT = '[A-Za-z0-9.-]+(:\\d+)?';

/**
 * Injection guard + structure guard for `PUBLIC_SITE_ORIGIN`: `new URL(...)` alone isn't
 * enough (it accepts e.g. a `"` in the host or a path, and `.origin`/`.hostname` return the
 * raw characters unchanged). This narrow pattern is the actual protection — it checks the
 * trimmed raw value before `new URL()` is even called (mirrors `SCRIPT_ORIGIN_PATTERN` below).
 * Deliberately allows BOTH `http:` and `https:` (unlike analytics) — a local/LAN instance may
 * need `http://`. Deliberate consequence: an origin with a path/query/hash
 * (`https://example.org/sub`) does NOT match and falls back to the default instead of being
 * silently truncated — a base-path deployment is `config.kit.paths.base`'s job, not this origin
 * config's (and `instanceUrl()` itself only accepts root-absolute paths, never `resolve()`
 * output — see its docs).
 */
const SITE_ORIGIN_PATTERN = new RegExp(`^https?://${ORIGIN_HOST_PORT}$`);

/**
 * Strips trailing slashes and validates against `SITE_ORIGIN_PATTERN`. Invalid/empty values
 * fall back to the default instead of throwing — a broken `PUBLIC_SITE_ORIGIN` must not 500 the
 * app. `new URL()` here only normalizes (e.g. host casing; a trailing dot in an FQDN is
 * preserved), it isn't the protection itself — that's solely the pattern above. Exported so
 * tests can call the pure validation logic directly instead of only reaching it via
 * `vi.resetModules()` + a dynamic re-import of the singleton.
 */
export function resolveOrigin(raw: string | undefined): { origin: string; originHost: string } {
	const candidate = (raw ?? '').trim().replace(/\/+$/, '');
	if (candidate && SITE_ORIGIN_PATTERN.test(candidate)) {
		try {
			const url = new URL(candidate);
			return { origin: url.origin, originHost: url.hostname };
		} catch {
			// SITE_ORIGIN_PATTERN should already rule this out — falls back to the default below
		}
	}
	return { origin: DEFAULT_ORIGIN, originHost: DEFAULT_ORIGIN_HOST };
}

/** `websiteId` is a Umami UUID/slug — deliberately narrow here (injection guard). */
const WEBSITE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Injection guard for `scriptOrigin`: `new URL(...).origin` ALONE is not sufficient —
 * `new URL()` accepts e.g. a `"` in the host and `.origin` returns it unchanged
 * (`new URL('https://x"onload=alert(1)').origin === 'https://x"onload=alert(1)'`), which would
 * break out of the `src="${scriptOrigin}/script.js"` attribute in the snippet. This narrow
 * pattern is the actual protection: only `https:` (unlike `SITE_ORIGIN_PATTERN` above —
 * analytics has no http exception), host characters restricted to `[A-Za-z0-9.-]` via
 * `ORIGIN_HOST_PORT`, optional `:port` (e.g. for a self-hosted analytics instance on localhost
 * during setup).
 */
const SCRIPT_ORIGIN_PATTERN = new RegExp(`^https://${ORIGIN_HOST_PORT}$`);

/**
 * Analytics is opt-in with no fallback: `analyticsHeadSnippet()` only emits anything when BOTH
 * variables are set and valid. `scriptOrigin` must match the narrow pattern above (the snippet
 * output lands unescaped in the HTML), `websiteId` must match `WEBSITE_ID_PATTERN`. Exported
 * (see `resolveOrigin`) so the pure validation can be tested directly.
 */
export function resolveAnalytics(
	rawScriptOrigin: string | undefined,
	rawWebsiteId: string | undefined
): InstanceAnalytics {
	const off: InstanceAnalytics = { scriptOrigin: '', websiteId: '' };

	const scriptOrigin = (rawScriptOrigin ?? '').trim().replace(/\/+$/, '');
	const websiteId = (rawWebsiteId ?? '').trim();
	if (!scriptOrigin || !websiteId) return off;
	if (!WEBSITE_ID_PATTERN.test(websiteId)) return off;
	if (!SCRIPT_ORIGIN_PATTERN.test(scriptOrigin)) return off;

	try {
		// Normalizes (e.g. IDN hosts) rather than returning the raw candidate — the pattern
		// above is the guard, `url.origin` here is only normalization, not additional protection.
		const url = new URL(scriptOrigin);
		return { scriptOrigin: url.origin, websiteId };
	} catch {
		return off;
	}
}

const { origin, originHost } = resolveOrigin(env.PUBLIC_SITE_ORIGIN);

export const instance: InstanceConfig = {
	origin,
	originHost,
	city: env.PUBLIC_INSTANCE_CITY?.trim() || 'Lüneburg',
	// Partial (issue #473 decision): only renames this value, doesn't rewrite the ~89
	// "AllerLeih" occurrences in the German copy nor the image assets (logo, icons).
	appName: env.PUBLIC_APP_NAME?.trim() || 'AllerLeih',
	contactEmail: env.PUBLIC_CONTACT_EMAIL?.trim() || 'kontakt@allerleih.org',
	// Operator address, not city-specific — hardcoded here rather than env-fed.
	feedbackEmail: 'feedback@allerleih.org',
	social: {
		telegram: 'https://t.me/allerleih_org',
		mastodon: 'https://norden.social/@AllerLeih',
		pixelfed: 'https://pixelfed.de/AllerLeih',
		instagram: 'https://www.instagram.com/aller.leih/',
	},
	links: {
		github: 'https://github.com/share-open-sharing-infrastructure/share-mvp',
		contributeBoard:
			'https://allerleih.notion.site/36de086dc6ab80f69529e6cf68afe7c4?v=36de086dc6ab80869c89000c98bbac63',
	},
	imprint: {
		operator: 'AllerLeih e.V.',
		representative: 'Vertreten durch Matteo Ramin und Timo Johner',
		street: 'Lüner Weg 17',
		postalCode: '21337',
		city: 'Lüneburg',
		country: 'Deutschland',
		legal: {
			supervisoryAuthority:
				'Zuständige Aufsichtsbehörde: Falls der Betreiber einer behördlichen Aufsicht unterliegt (z. B. Finanzdienstleister, Versicherungsvermittler).',
			professionalRegulation:
				'Berufsrechtliche Angaben: Für reglementierte Berufe wie Anwälte, Ärzte oder Steuerberater (Berufsbezeichnung, Kammer, berufsrechtliche Regelungen).',
			vatId: 'Umsatzsteuer-Identifikationsnummer (falls vorhanden): Nach § 27a UStG.',
			registerEntry:
				'Vereinsregisternummer: VR 202438 (Amtsgericht Lüneburg).',
			disputeResolution:
				'Hinweis auf die Online-Streitbeilegung (für Online-Shops): Link zur EU-Plattform zur Streitbeilegung.',
			management: 'GmbH & Co. KG, AG, UG: Angabe der Geschäftsführer oder Vorstandsmitglieder.',
		}
	},
	analytics: resolveAnalytics(env.PUBLIC_ANALYTICS_ORIGIN, env.PUBLIC_ANALYTICS_WEBSITE_ID),
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
 * instead of trusting the caller: `InstanceAnalytics` is a plain data type (no branded/nominal
 * typing), every caller here already passes validated values, but the signature alone doesn't
 * enforce that — the check is cheap and idempotent, so better to redo it here.
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
