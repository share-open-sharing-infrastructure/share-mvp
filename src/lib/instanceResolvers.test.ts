import { describe, it, expect } from 'vitest';
import { resolveOrigin, isFlagshipOrigin, isValidSiteOrigin, resolveAnalytics } from './instanceResolvers';

// Pure validation logic, called directly — no module reset / env mocking needed, since every
// function here takes its input as an argument instead of reading `$env/dynamic/public` (see
// this module's header comment for why that split exists).
describe('resolveOrigin (pure validation)', () => {
	it('accepts a valid https origin and strips a trailing slash', () => {
		expect(resolveOrigin('https://marburg.example.org/')).toEqual({
			origin: 'https://marburg.example.org',
			originHost: 'marburg.example.org',
		});
	});

	it('falls back to the default origin for an unparseable value, never throws', () => {
		expect(resolveOrigin('nicht-eine-url')).toEqual({
			origin: 'https://allerleih.org',
			originHost: 'allerleih.org',
		});
	});

	it('falls back to the default origin for a non-http(s) protocol', () => {
		expect(resolveOrigin('ftp://example.org')).toEqual({
			origin: 'https://allerleih.org',
			originHost: 'allerleih.org',
		});
	});

	it('falls back to the default origin for an empty/whitespace-only value', () => {
		expect(resolveOrigin('   ')).toEqual({
			origin: 'https://allerleih.org',
			originHost: 'allerleih.org',
		});
		expect(resolveOrigin(undefined)).toEqual({
			origin: 'https://allerleih.org',
			originHost: 'allerleih.org',
		});
	});

	it('accepts a local/LAN http origin (deliberately allowed, unlike analytics)', () => {
		expect(resolveOrigin('http://localhost:5173')).toEqual({
			origin: 'http://localhost:5173',
			originHost: 'localhost',
		});
	});

	it('rejects a value that would break out of the JSON-LD <script> tag (attribute/tag breakout guard)', () => {
		expect(resolveOrigin('https://evil.example/a</script><script>alert(1)</script>')).toEqual({
			origin: 'https://allerleih.org',
			originHost: 'allerleih.org',
		});
	});

	it('rejects a bare-quote host (attribute breakout guard) — new URL().origin alone is not sufficient', () => {
		// Sanity check on the premise: `new URL()` accepts a `"` in the host and keeps it in `.origin`.
		expect(new URL('https://analytics.allerleih.org"onload=alert(1)').origin).toBe(
			'https://analytics.allerleih.org"onload=alert(1)'
		);
		expect(resolveOrigin('https://analytics.allerleih.org"onload=alert(1)')).toEqual({
			origin: 'https://allerleih.org',
			originHost: 'allerleih.org',
		});
	});

	it('rejects a value carrying a path — a base-path deployment is config.kit.paths.base, not this', () => {
		expect(resolveOrigin('https://example.org/sub')).toEqual({
			origin: 'https://allerleih.org',
			originHost: 'allerleih.org',
		});
	});

	it('normalizes an uppercase host to lowercase (new URL() normalization, not a rejection)', () => {
		expect(resolveOrigin('https://EXAMPLE.ORG')).toEqual({
			origin: 'https://example.org',
			originHost: 'example.org',
		});
	});

	it('accepts a trailing-dot FQDN host as-is (a valid, if unusual, hostname)', () => {
		expect(resolveOrigin('https://example.org.')).toEqual({
			origin: 'https://example.org.',
			originHost: 'example.org.',
		});
	});
});

describe('isFlagshipOrigin (pure validation)', () => {
	it('treats unset as flagship — the production case (issue #646 finding F1): allerleih.org boots with PUBLIC_SITE_ORIGIN unset, so unset MUST resolve to true or the flagship deploy would suddenly demand its own imprint', () => {
		expect(isFlagshipOrigin(undefined)).toBe(true);
	});

	it('treats the flagship origin itself as flagship', () => {
		expect(isFlagshipOrigin('https://allerleih.org')).toBe(true);
	});

	it('treats any other valid origin as non-flagship', () => {
		expect(isFlagshipOrigin('https://marburg.example.org')).toBe(false);
	});

	it('treats an invalid origin as flagship too (it falls back to the default — see isValidSiteOrigin for the guard against this)', () => {
		expect(isFlagshipOrigin('not-a-url')).toBe(true);
	});
});

describe('isValidSiteOrigin (pure validation)', () => {
	it('accepts a well-formed http(s) origin', () => {
		expect(isValidSiteOrigin('https://marburg.example.org')).toBe(true);
		expect(isValidSiteOrigin('http://localhost:5173')).toBe(true);
	});

	it('rejects unset/empty', () => {
		expect(isValidSiteOrigin(undefined)).toBe(false);
		expect(isValidSiteOrigin('   ')).toBe(false);
	});

	it('rejects a value that would silently fall back to the flagship default', () => {
		expect(isValidSiteOrigin('not-a-url')).toBe(false);
		expect(isValidSiteOrigin('https://example.org/sub')).toBe(false);
	});

	it('closes the masking hole: an invalid origin is flagship per isFlagshipOrigin() but invalid per this predicate — callers need both', () => {
		expect(isFlagshipOrigin('not-a-url')).toBe(true);
		expect(isValidSiteOrigin('not-a-url')).toBe(false);
	});
});

// `buildAnalyticsSnippet` stays a `$lib/instance.ts` URL/snippet helper and is tested there
// (`instance.test.ts`'s `buildAnalyticsSnippet (pure validation)` describe block) — this block
// only covers `resolveAnalytics`'s own validation, not the downstream snippet formatting.
describe('resolveAnalytics (pure validation)', () => {
	const VALID_ORIGIN = 'https://analytics.allerleih.org';
	const VALID_WEBSITE_ID = '6cfb6acd-259e-4771-baa7-c677387ea292';

	it('is off when either value is missing', () => {
		expect(resolveAnalytics(undefined, VALID_WEBSITE_ID)).toEqual({
			scriptOrigin: '',
			websiteId: '',
		});
		expect(resolveAnalytics(VALID_ORIGIN, undefined)).toEqual({
			scriptOrigin: '',
			websiteId: '',
		});
	});

	it('rejects a non-https analytics script origin', () => {
		expect(resolveAnalytics('http://analytics.allerleih.org', VALID_WEBSITE_ID)).toEqual({
			scriptOrigin: '',
			websiteId: '',
		});
	});

	it('rejects a website id that would break out of the HTML attribute (injection guard)', () => {
		expect(resolveAnalytics(VALID_ORIGIN, '"><img src=x onerror=alert(1)>')).toEqual({
			scriptOrigin: '',
			websiteId: '',
		});
	});

	it('rejects a script origin containing a quote (attribute breakout guard) — new URL().origin alone is not sufficient', () => {
		// Sanity check on the premise: `new URL()` accepts a `"` in the host and keeps it in `.origin`.
		expect(new URL('https://analytics.allerleih.org"onload=alert(1)').origin).toBe(
			'https://analytics.allerleih.org"onload=alert(1)'
		);

		expect(
			resolveAnalytics('https://analytics.allerleih.org"onload=alert(1)', VALID_WEBSITE_ID)
		).toEqual({ scriptOrigin: '', websiteId: '' });
	});

	it('resolves both values when valid', () => {
		expect(resolveAnalytics(VALID_ORIGIN, VALID_WEBSITE_ID)).toEqual({
			scriptOrigin: VALID_ORIGIN,
			websiteId: VALID_WEBSITE_ID,
		});
	});
});
