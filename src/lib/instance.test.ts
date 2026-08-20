import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hermetic default env: mocked so a local `.env` (which may set real PUBLIC_* vars for dev)
// can never skew what "no env vars set" means here.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import {
	instance,
	instanceUrl,
	analyticsHeadSnippet,
	resolveOrigin,
	resolveAnalytics,
	buildAnalyticsSnippet,
} from './instance';

describe('instance — defaults (no env vars set)', () => {
	it('resolves the Lüneburg/allerleih.org defaults', () => {
		expect(instance.origin).toBe('https://allerleih.org');
		expect(instance.originHost).toBe('allerleih.org');
		expect(instance.city).toBe('Lüneburg');
		expect(instance.appName).toBe('AllerLeih');
		expect(instance.contactEmail).toBe('kontakt@allerleih.org');
		expect(instance.feedbackEmail).toBe('feedback@allerleih.org');
	});

	it('carries the operator-owned social/links/imprint literals', () => {
		expect(instance.social).toEqual({
			telegram: 'https://t.me/allerleih_org',
			mastodon: 'https://norden.social/@AllerLeih',
			pixelfed: 'https://pixelfed.de/AllerLeih',
			instagram: 'https://www.instagram.com/aller.leih/',
		});
		expect(instance.links).toEqual({
			github: 'https://github.com/share-open-sharing-infrastructure/share-mvp',
			contributeBoard:
				'https://allerleih.notion.site/36de086dc6ab80f69529e6cf68afe7c4?v=36de086dc6ab80869c89000c98bbac63',
		});
		expect(instance.imprint).toEqual({
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
				registerEntry: 'Vereinsregisternummer: VR 202438 (Amtsgericht Lüneburg).',
				disputeResolution:
					'Hinweis auf die Online-Streitbeilegung (für Online-Shops): Link zur EU-Plattform zur Streitbeilegung.',
				management: 'GmbH & Co. KG, AG, UG: Angabe der Geschäftsführer oder Vorstandsmitglieder.',
			},
		});
	});

	it('leaves analytics off (opt-in, no fallback instance)', () => {
		expect(instance.analytics).toEqual({ scriptOrigin: '', websiteId: '' });
	});

	it('instanceUrl prepends the default origin', () => {
		expect(instanceUrl('/')).toBe('https://allerleih.org/');
		expect(instanceUrl('/items/abc')).toBe('https://allerleih.org/items/abc');
	});

	it('instanceUrl does not warn for a root-absolute path', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		instanceUrl('/misc/imprint');
		expect(errorSpy).not.toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('instanceUrl warns (DEV-only), but still returns a value, for a non-root-absolute path — the resolve()/paths.relative trap (issue #473 round 4)', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		// e.g. what a page-relative `resolve()` result under SSR would look like.
		expect(instanceUrl('../misc/imprint')).toBe('https://allerleih.org../misc/imprint');
		expect(errorSpy).toHaveBeenCalledTimes(1);
		errorSpy.mockRestore();
	});

	it('analyticsHeadSnippet is empty when analytics is unset', () => {
		expect(analyticsHeadSnippet()).toBe('');
	});
});

// Pure validation logic, called directly — no module reset / env mocking needed since
// resolveOrigin/resolveAnalytics/buildAnalyticsSnippet take their input as arguments.
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

describe('resolveAnalytics + buildAnalyticsSnippet (pure validation)', () => {
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
		const analytics = resolveAnalytics('http://analytics.allerleih.org', VALID_WEBSITE_ID);
		expect(analytics).toEqual({ scriptOrigin: '', websiteId: '' });
		expect(buildAnalyticsSnippet(analytics)).toBe('');
	});

	it('rejects a website id that would break out of the HTML attribute (injection guard)', () => {
		const analytics = resolveAnalytics(VALID_ORIGIN, '"><img src=x onerror=alert(1)>');
		expect(analytics).toEqual({ scriptOrigin: '', websiteId: '' });
		expect(buildAnalyticsSnippet(analytics)).toBe('');
	});

	it('rejects a script origin containing a quote (attribute breakout guard) — new URL().origin alone is not sufficient', () => {
		// Sanity check on the premise: `new URL()` accepts a `"` in the host and keeps it in `.origin`.
		expect(new URL('https://analytics.allerleih.org"onload=alert(1)').origin).toBe(
			'https://analytics.allerleih.org"onload=alert(1)'
		);

		const analytics = resolveAnalytics(
			'https://analytics.allerleih.org"onload=alert(1)',
			VALID_WEBSITE_ID
		);
		expect(analytics).toEqual({ scriptOrigin: '', websiteId: '' });
		expect(buildAnalyticsSnippet(analytics)).toBe('');
	});

	it('emits exactly the two production script tags byte-for-byte when both vars are valid', () => {
		const analytics = resolveAnalytics(VALID_ORIGIN, VALID_WEBSITE_ID);
		expect(buildAnalyticsSnippet(analytics)).toBe(
			`<script defer src="${VALID_ORIGIN}/script.js" data-website-id="${VALID_WEBSITE_ID}"></script>\n` +
				`<script defer src="${VALID_ORIGIN}/recorder.js" data-website-id="${VALID_WEBSITE_ID}"></script>`
		);
	});

	it('buildAnalyticsSnippet re-validates its argument instead of trusting the caller', () => {
		// A hand-built InstanceAnalytics that never went through resolveAnalytics() — the type
		// alone doesn't guarantee validity, so buildAnalyticsSnippet() must guard itself.
		const unvalidated = { scriptOrigin: 'https://analytics.allerleih.org"onload=alert(1)', websiteId: VALID_WEBSITE_ID };
		expect(buildAnalyticsSnippet(unvalidated)).toBe('');
	});
});

// Genuine env-integration tests: that the env vars are actually wired to the right
// `instance` fields / exported functions at all — the module-reset dance is only worth
// paying for this, not for re-deriving validation logic already covered directly above.
describe('instance — env var wiring (integration)', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.doUnmock('$env/dynamic/public');
	});

	it('wires PUBLIC_SITE_ORIGIN into instance.origin/originHost and instanceUrl()', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_SITE_ORIGIN: 'https://marburg.example.org' },
		}));
		const { instance: overridden, instanceUrl: overriddenInstanceUrl } = await import('./instance');
		expect(overridden.origin).toBe('https://marburg.example.org');
		expect(overridden.originHost).toBe('marburg.example.org');
		expect(overriddenInstanceUrl('/items/abc')).toBe('https://marburg.example.org/items/abc');
	});

	it('applies PUBLIC_INSTANCE_CITY and keeps every other field at its default', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_INSTANCE_CITY: 'Marburg' },
		}));
		const { instance: overridden } = await import('./instance');
		expect(overridden.city).toBe('Marburg');
		expect(overridden.origin).toBe('https://allerleih.org');
		expect(overridden.appName).toBe('AllerLeih');
	});

	it('wires PUBLIC_ANALYTICS_ORIGIN/PUBLIC_ANALYTICS_WEBSITE_ID into instance.analytics and analyticsHeadSnippet()', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: {
				PUBLIC_ANALYTICS_ORIGIN: 'https://analytics.allerleih.org',
				PUBLIC_ANALYTICS_WEBSITE_ID: '6cfb6acd-259e-4771-baa7-c677387ea292',
			},
		}));
		const { instance: overridden, analyticsHeadSnippet: overriddenSnippet } = await import(
			'./instance'
		);
		expect(overridden.analytics).toEqual({
			scriptOrigin: 'https://analytics.allerleih.org',
			websiteId: '6cfb6acd-259e-4771-baa7-c677387ea292',
		});
		expect(overriddenSnippet()).toBe(
			'<script defer src="https://analytics.allerleih.org/script.js" data-website-id="6cfb6acd-259e-4771-baa7-c677387ea292"></script>\n' +
				'<script defer src="https://analytics.allerleih.org/recorder.js" data-website-id="6cfb6acd-259e-4771-baa7-c677387ea292"></script>'
		);
	});
});
