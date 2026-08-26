import { describe, it, expect } from 'vitest';
import {
	resolveOrigin,
	isFlagshipOrigin,
	isValidSiteOrigin,
	resolveAnalytics,
	resolveExternalFormUrl,
	resolveOnboardingSurvey,
} from './instanceResolvers';

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

// Class D (share-mvp#631) — the Tally onboarding survey / Keila newsletter form URLs. Unlike
// `resolveOrigin`/`resolveAnalytics`, there is no "off" default distinct from `''`: any
// invalid/empty input resolves to the same empty string, since there is no fallback instance to
// route to (see `$lib/instance.ts`'s Class-D header paragraph for why).
describe('resolveExternalFormUrl (pure validation)', () => {
	const KEILA_URL = 'https://app.keila.io/forms/nfrm_b94Bj5RD';
	const QUERY_URL =
		'https://tally.so/embed/Pdropd?alignLeft=1&hideTitle=1&transparentBackground=1';

	it('accepts a plain form URL unchanged', () => {
		expect(resolveExternalFormUrl(KEILA_URL)).toBe(KEILA_URL);
	});

	it('accepts a form URL with a query string unchanged', () => {
		expect(resolveExternalFormUrl(QUERY_URL)).toBe(QUERY_URL);
	});

	it('resolves to empty for unset/empty/whitespace-only input', () => {
		expect(resolveExternalFormUrl(undefined)).toBe('');
		expect(resolveExternalFormUrl('')).toBe('');
		expect(resolveExternalFormUrl('   ')).toBe('');
	});

	it('rejects http:// — unlike resolveOrigin, there is no local/LAN exception for a third-party data sink', () => {
		expect(resolveExternalFormUrl('http://app.keila.io/forms/x')).toBe('');
	});

	it('rejects non-http(s) protocols', () => {
		expect(resolveExternalFormUrl('javascript:alert(1)')).toBe('');
		expect(resolveExternalFormUrl('ftp://example.org/x')).toBe('');
	});

	it('rejects a value that would break out of the action=/src= attribute (attribute breakout guard)', () => {
		expect(resolveExternalFormUrl('https://app.keila.io/forms/x" onload=alert(1)')).toBe('');
	});

	it('rejects a bare apostrophe in the path — new URL() alone does not sanitize it, unlike ", <, >, backtick and space (which it percent-encodes)', () => {
		// Sanity check on the premise: unlike the other breakout characters, `new URL()` does NOT
		// percent-encode a bare "'" in a path — the pattern above is the actual protection for a
		// single-quoted attribute, `new URL()` alone is not sufficient (mirrors resolveOrigin's/
		// resolveAnalytics' analogous premise check for a `"` surviving unescaped in a host).
		expect(new URL("https://x.example/a'b").pathname).toBe("/a'b");
		expect(resolveExternalFormUrl("https://x.example/a'b")).toBe('');
	});

	it('rejects a value that would break out of the enclosing <script>/<iframe> tag (tag breakout guard)', () => {
		expect(
			resolveExternalFormUrl('https://x.example/a</script><script>alert(1)</script>')
		).toBe('');
	});

	it('rejects a backtick, space, "<", ">", or "\'" anywhere in the path', () => {
		expect(resolveExternalFormUrl('https://x.example/a`b')).toBe('');
		expect(resolveExternalFormUrl('https://x.example/a b')).toBe('');
		expect(resolveExternalFormUrl('https://x.example/a<b')).toBe('');
		expect(resolveExternalFormUrl('https://x.example/a>b')).toBe('');
		expect(resolveExternalFormUrl("https://x.example/a'b")).toBe('');
	});

	it('keeps a trailing slash — deliberately, unlike resolveOrigin (it can be semantically part of the form path)', () => {
		expect(resolveExternalFormUrl('https://x.example/forms/')).toBe('https://x.example/forms/');
	});

	it('rejects a path carrying a #fragment (decision pinned deliberately, not just an oversight)', () => {
		expect(resolveExternalFormUrl('https://x.example/forms/x#section')).toBe('');
	});
});

describe('resolveOnboardingSurvey (pure validation)', () => {
	it('derives origin + scriptUrl from a valid Tally URL, keeping the url itself unchanged', () => {
		const url =
			'https://tally.so/embed/Pdropd?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1&formEventsForwarding=1';
		expect(resolveOnboardingSurvey(url)).toEqual({
			url,
			origin: 'https://tally.so',
			scriptUrl: 'https://tally.so/widgets/embed.js',
		});
	});

	it('resolves all three fields to empty for unset/invalid input — scriptUrl never exists without a url', () => {
		expect(resolveOnboardingSurvey(undefined)).toEqual({ url: '', scriptUrl: '', origin: '' });
		expect(resolveOnboardingSurvey('not-a-url')).toEqual({ url: '', scriptUrl: '', origin: '' });
	});

	it('derives scriptUrl from whatever host is configured, never hardcoded to tally.so (acceptance criterion)', () => {
		const url = 'https://survey.example.org/embed/xyz';
		const result = resolveOnboardingSurvey(url);
		expect(result.origin).toBe('https://survey.example.org');
		expect(result.scriptUrl).toBe('https://survey.example.org/widgets/embed.js');
		expect(result.scriptUrl).not.toContain('tally.so');
	});
});
