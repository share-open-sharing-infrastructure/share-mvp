import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hermetic default env: mocked so a local `.env` (which may set real PUBLIC_* vars for dev)
// can never skew what "no env vars set" means here.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { instance, instanceUrl, analyticsHeadSnippet, buildAnalyticsSnippet } from './instance';
import { resolveAnalytics } from './instanceResolvers';

// "No env vars set" resolves to the FLAGSHIP instance (isFlagshipOrigin(undefined) === true,
// issue #646 finding F1) — every value asserted below is the flagship's OWN default, not a
// generic one. See the "non-flagship" describe blocks further down for the other branch.
describe('instance — flagship defaults (no env vars set)', () => {
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
			// Moved up from `legal` in #629 — it's real operator data (§5 Nr. 4 TMG), not the
			// generic placeholder guidance the other five `legal.*` fields carry.
			registerEntry: 'Vereinsregisternummer: VR 202438 (Amtsgericht Lüneburg).',
			legal: {
				supervisoryAuthority:
					'Zuständige Aufsichtsbehörde: Falls der Betreiber einer behördlichen Aufsicht unterliegt (z. B. Finanzdienstleister, Versicherungsvermittler).',
				professionalRegulation:
					'Berufsrechtliche Angaben: Für reglementierte Berufe wie Anwälte, Ärzte oder Steuerberater (Berufsbezeichnung, Kammer, berufsrechtliche Regelungen).',
				vatId: 'Umsatzsteuer-Identifikationsnummer (falls vorhanden): Nach § 27a UStG.',
				disputeResolution:
					'Hinweis auf die Online-Streitbeilegung (für Online-Shops): Link zur EU-Plattform zur Streitbeilegung.',
				management: 'GmbH & Co. KG, AG, UG: Angabe der Geschäftsführer oder Vorstandsmitglieder.',
			},
		});
	});

	it('leaves analytics off (opt-in, no fallback instance)', () => {
		expect(instance.analytics).toEqual({ scriptOrigin: '', websiteId: '' });
	});

	// Pins the Class-D "no default, not even on the flagship" decision (share-mvp#631) — unlike
	// EVERY other value in this describe block, these two stay empty even though this IS the
	// flagship instance. A flagship literal here (like `FLAGSHIP_CONTACT_EMAIL`) would mean a
	// forgotten env var silently pipes a self-hoster's survey answers/newsletter signups into
	// allerleih.org's OWN Tally/Keila account — the inverse failure mode of a missing imprint.
	it('leaves the onboarding survey and newsletter off even on the flagship (Class D — no fallback instance)', () => {
		expect(instance.onboardingSurvey).toEqual({ url: '', scriptUrl: '', origin: '' });
		expect(instance.newsletterFormUrl).toBe('');
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

	it('has a non-empty FAQ founder-bio answer', () => {
		const whoWeAre = instance.faq.faqItems[0].a;
		expect(typeof whoWeAre).toBe('string');
		expect(whoWeAre.length).toBeGreaterThan(0);
	});

	it('pins the current flagship founder-bio content (Lüneburg, deliberately not CITY-interpolated) — flagship-only since #629', () => {
		expect(instance.faq.faqItems[0].a).toContain('Lüneburg');
	});
});

// `resolveOrigin`/`isFlagshipOrigin`/`isValidSiteOrigin`/`resolveAnalytics` are pure functions
// that take their input as arguments — they live in, and are tested directly in,
// `instanceResolvers.ts`/`instanceResolvers.test.ts`. `buildAnalyticsSnippet` below is the one
// piece of that pipeline that stays a `$lib/instance.ts` URL/snippet helper.
describe('buildAnalyticsSnippet (pure validation)', () => {
	const VALID_ORIGIN = 'https://analytics.allerleih.org';
	const VALID_WEBSITE_ID = '6cfb6acd-259e-4771-baa7-c677387ea292';

	it('is empty for an off/empty InstanceAnalytics value', () => {
		expect(buildAnalyticsSnippet({ scriptOrigin: '', websiteId: '' })).toBe('');
	});

	it('emits exactly the two production script tags byte-for-byte when both vars are valid', () => {
		const analytics = resolveAnalytics(VALID_ORIGIN, VALID_WEBSITE_ID);
		expect(buildAnalyticsSnippet(analytics)).toBe(
			`<script defer src="${VALID_ORIGIN}/script.js" data-website-id="${VALID_WEBSITE_ID}"></script>\n` +
				`<script defer src="${VALID_ORIGIN}/recorder.js" data-website-id="${VALID_WEBSITE_ID}"></script>`
		);
	});

	it('re-validates its argument instead of trusting the caller', () => {
		// A hand-built InstanceAnalytics that never went through resolveAnalytics() — the type
		// alone doesn't guarantee validity, so buildAnalyticsSnippet() must guard itself.
		const unvalidated = {
			scriptOrigin: 'https://analytics.allerleih.org"onload=alert(1)',
			websiteId: VALID_WEBSITE_ID,
		};
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

	it('keeps faq/team static prose unchanged as long as the instance stays flagship — not a template', async () => {
		// PUBLIC_SITE_ORIGIN stays unset here, so this is still the flagship instance (see
		// isFlagshipOrigin() describe block below) — only a NON-flagship instance drops the
		// founder-bio intro and the team roster (covered separately below).
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_INSTANCE_CITY: 'Marburg', PUBLIC_APP_NAME: 'AndersLeih' },
		}));
		const { instance: overridden } = await import('./instance');
		expect(overridden.faq.faqItems[0].a).toBe(instance.faq.faqItems[0].a);
		expect(overridden.faq.faqItems[0].a).toContain('Lüneburg');
		expect(overridden.team).toEqual(instance.team);
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

	it('wires PUBLIC_ONBOARDING_SURVEY_URL/PUBLIC_NEWSLETTER_FORM_URL into instance.onboardingSurvey/newsletterFormUrl', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: {
				PUBLIC_ONBOARDING_SURVEY_URL:
					'https://tally.so/embed/Pdropd?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1&formEventsForwarding=1',
				PUBLIC_NEWSLETTER_FORM_URL: 'https://app.keila.io/forms/nfrm_b94Bj5RD',
			},
		}));
		const { instance: overridden } = await import('./instance');
		expect(overridden.onboardingSurvey).toEqual({
			url: 'https://tally.so/embed/Pdropd?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1&formEventsForwarding=1',
			scriptUrl: 'https://tally.so/widgets/embed.js',
			origin: 'https://tally.so',
		});
		expect(overridden.newsletterFormUrl).toBe('https://app.keila.io/forms/nfrm_b94Bj5RD');
	});

	it('an invalid Class-D value resolves to off, not a 500 — http:// is rejected same as SCRIPT_ORIGIN_PATTERN', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_NEWSLETTER_FORM_URL: 'http://app.keila.io/forms/x' },
		}));
		const { instance: overridden } = await import('./instance');
		expect(overridden.newsletterFormUrl).toBe('');
	});

	/** Recursively collects every string leaf under `node`, for the denylist walk below. Matches
	 *  `texts.test.ts`'s `collectStrings` — kept identical rather than diverging with a redundant
	 *  `Array.isArray` branch: `Object.values()` on an array already yields its elements in
	 *  order, so the generic `object` branch below covers arrays too. */
	function collectStrings(node: unknown): string[] {
		if (typeof node === 'string') return [node];
		if (node && typeof node === 'object') return Object.values(node).flatMap(collectStrings);
		return [];
	}

	// The central regression guard for #629: a fully-configured non-flagship instance must
	// leak NOTHING that identifies the flagship operator — not the city, not the legal entity,
	// not a team member's name, not the register entry, not a social handle. This is the test
	// that would have caught #629's premise (a self-hoster's imprint silently showing Lüneburg).
	// Every founder first name from `FLAGSHIP_FOUNDER_INTRO` is listed (not just the two whose
	// full name appears in `FLAGSHIP_TEAM`), and the comparison is case-insensitive so it also
	// catches a lowercase occurrence like the `matteo-ramin` LinkedIn slug.
	const FLAGSHIP_DENYLIST = [
		'Lüneburg',
		'allerleih.org',
		'AllerLeih e.V.',
		'Matteo',
		'Timo',
		'Rocho',
		'Falk',
		'Julia',
		'Madita',
		'Christian',
		'VR 202438',
		'norden.social',
		'notion.site',
		// Class D (share-mvp#631): a later-smuggled flagship default for the survey/newsletter
		// URL would be caught here automatically, same as any other flagship literal.
		'tally.so',
		'keila.io',
	];

	it('leaks no flagship-operator data anywhere in `instance` for a fully-configured non-flagship instance', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: {
				PUBLIC_SITE_ORIGIN: 'https://marburg.example.org',
				PUBLIC_INSTANCE_CITY: 'Marburg',
				PUBLIC_CONTACT_EMAIL: 'kontakt@marburg.example.org',
				PUBLIC_IMPRINT_OPERATOR: 'Marburg Teilt e.V.',
				PUBLIC_IMPRINT_STREET: 'Teststraße 1',
				PUBLIC_IMPRINT_POSTAL_CODE: '35037',
				PUBLIC_IMPRINT_CITY: 'Marburg',
				PUBLIC_IMPRINT_COUNTRY: 'Deutschland',
				PUBLIC_IMPRINT_REPRESENTATIVE: 'Vertreten durch Erika Musterfrau',
				PUBLIC_IMPRINT_REGISTER_ENTRY: 'Vereinsregisternummer: VR 99999 (Amtsgericht Marburg).',
				PUBLIC_FEEDBACK_EMAIL: 'feedback@marburg.example.org',
				PUBLIC_SOCIAL_TELEGRAM: 'https://t.me/marburg_teilt',
				PUBLIC_SOCIAL_MASTODON: 'https://mastodon.social/@MarburgTeilt',
				PUBLIC_SOCIAL_PIXELFED: 'https://pixelfed.social/MarburgTeilt',
				PUBLIC_SOCIAL_INSTAGRAM: 'https://www.instagram.com/marburg.teilt/',
				PUBLIC_CONTRIBUTE_URL: 'https://marburg-teilt.example.org/mitmachen',
			},
		}));
		const { instance: overridden } = await import('./instance');

		const strings = collectStrings(overridden);
		expect(strings.length).toBeGreaterThan(0);
		for (const forbidden of FLAGSHIP_DENYLIST) {
			for (const value of strings) {
				expect(value.toLowerCase()).not.toContain(forbidden.toLowerCase());
			}
		}
	});

	it('blanks Class B fields, empties the team, and leaves the city empty on a non-flagship instance with nothing else set', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_SITE_ORIGIN: 'https://marburg.example.org' },
		}));
		const { instance: overridden } = await import('./instance');

		// Class A, unconfigured — no flagship literal must leak through (#646 finding, S1).
		expect(overridden.city).toBe('');
		expect(overridden.social).toEqual({
			telegram: '',
			mastodon: '',
			pixelfed: '',
			instagram: '',
		});
		expect(overridden.links.contributeBoard).toBe('');
		// Class C stays populated regardless — not flagship-gated.
		expect(overridden.links.github).toBe(
			'https://github.com/share-open-sharing-infrastructure/share-mvp'
		);
		expect(overridden.feedbackEmail).toBe('');
		expect(overridden.team).toEqual([]);
		expect(overridden.faq.faqItems[0].a).not.toContain('Lüneburg');
	});
});
