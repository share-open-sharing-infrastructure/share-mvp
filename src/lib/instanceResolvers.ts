/**
 * Pure origin/analytics resolution and validation logic for `$lib/instance.ts` — split out by
 * #629/#646 (structural cleanup, `code-quality-reviewer`'s file-length concern): none of this
 * needs `$env/dynamic/public` itself, since every function here takes its raw input as an
 * argument. That's also why these are the functions unit-tested directly, with no
 * `vi.resetModules()`/`vi.doMock()` dance — see `instanceResolvers.test.ts`.
 *
 * No env access in this file, ever — `instance.ts` stays the one place that reads
 * `$env/dynamic/public` at module scope, per its own header comment. Reading env here would
 * defeat the point of the split (the reason these functions are pure and directly testable) and
 * would make this file unsafe to import from `src/service-worker.ts`, unlike `instance.ts`.
 */

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
 * output — see its docs in `instance.ts`).
 */
const SITE_ORIGIN_PATTERN = new RegExp(`^https?://${ORIGIN_HOST_PORT}$`);

/**
 * Strips trailing slashes and validates against `SITE_ORIGIN_PATTERN`. Invalid/empty values
 * fall back to the default instead of throwing — a broken `PUBLIC_SITE_ORIGIN` must not 500 the
 * app. `new URL()` here only normalizes (e.g. host casing; a trailing dot in an FQDN is
 * preserved), it isn't the protection itself — that's solely the pattern above. Exported so
 * tests can call the pure validation logic directly instead of only reaching it via
 * `vi.resetModules()` + a dynamic re-import of the `instance` singleton.
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

/**
 * Whether `raw` resolves to the flagship (allerleih.org) origin — gates "fall back to
 * `$lib/instanceDefaults.ts`" vs. "someone else's instance; Class-A values must come from env or
 * the server refuses to start" (`missingInstanceEnv()` in `$lib/server/env.ts`).
 *
 * CRITICAL: unset MUST count as flagship. Production sets neither `PUBLIC_SITE_ORIGIN` nor
 * `PUBLIC_INSTANCE_CITY` (`.github/workflows/deploy-to-uberspace.yaml` ~line 124 only appends
 * those `.env` lines when the repo Variable is non-empty, and neither is currently configured),
 * so allerleih.org boots with `raw === undefined` and depends on this resolving to `true`.
 * Gating on the RAW value instead of the RESOLVED origin would work today by coincidence but
 * break the moment anyone sets `PUBLIC_SITE_ORIGIN=https://allerleih.org` explicitly; routing
 * through `resolveOrigin()` first makes both cases equivalent by construction.
 */
export function isFlagshipOrigin(raw: string | undefined): boolean {
	return resolveOrigin(raw).origin === DEFAULT_ORIGIN;
}

/**
 * Whether `raw` itself (trimmed, slash-stripped) matches `SITE_ORIGIN_PATTERN` — i.e. whether
 * `resolveOrigin(raw)` returns `raw`'s OWN origin, not a silent fallback. A SEPARATE predicate,
 * not a third field on `resolveOrigin()`'s return value, which ~10 `toEqual` assertions in
 * `instance.test.ts` pin to exactly two fields.
 *
 * Closes a masking hole `isFlagshipOrigin()` can't see alone: an INVALID `PUBLIC_SITE_ORIGIN`
 * falls back to the default exactly like an UNSET one, so `isFlagshipOrigin()` reports `true`
 * for both — which would let a botched non-flagship deploy sail through `missingInstanceEnv()`
 * with the Lüneburg imprint still showing. `missingInstanceEnv()` checks this FIRST.
 */
export function isValidSiteOrigin(raw: string | undefined): boolean {
	const candidate = (raw ?? '').trim().replace(/\/+$/, '');
	return candidate !== '' && SITE_ORIGIN_PATTERN.test(candidate);
}

/** `websiteId` is a Umami UUID/slug — deliberately narrow here (injection guard). Exported so
 *  `instance.ts`'s `buildAnalyticsSnippet()` can re-validate against the same pattern. */
export const WEBSITE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Injection guard for `scriptOrigin`: `new URL(...).origin` ALONE is not sufficient —
 * `new URL()` accepts e.g. a `"` in the host and `.origin` returns it unchanged
 * (`new URL('https://x"onload=alert(1)').origin === 'https://x"onload=alert(1)'`), which would
 * break out of the `src="${scriptOrigin}/script.js"` attribute in the snippet. This narrow
 * pattern is the actual protection: only `https:` (unlike `SITE_ORIGIN_PATTERN` above —
 * analytics has no http exception), host characters restricted to `[A-Za-z0-9.-]` via
 * `ORIGIN_HOST_PORT`, optional `:port` (e.g. for a self-hosted analytics instance on localhost
 * during setup). Exported for the same re-validation reason as `WEBSITE_ID_PATTERN` above.
 */
export const SCRIPT_ORIGIN_PATTERN = new RegExp(`^https://${ORIGIN_HOST_PORT}$`);

/** Empty values ⇒ analytics fully off (opt-in, no fallback to a default instance). */
export interface InstanceAnalytics {
	scriptOrigin: string;
	websiteId: string;
}

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
