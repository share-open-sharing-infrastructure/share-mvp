import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hermetic default env — same reasoning as `instance.test.ts`: a local `.env` may set real
// PUBLIC_* vars for dev, which would otherwise decide what "no env vars set" means here.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { texts } from './texts';

/**
 * Guards the local-SEO strings (`texts.seo`, plus the visible `/search` h1).
 *
 * Two things are pinned, and only these:
 *  1. The indexable pages carry the instance's city — the whole point of the change. Without
 *     it the site only ranked on its brand name; "leihen <Stadt>" matched nothing.
 *  2. The city is *interpolated from `instance.city`*, never a literal. One build artifact
 *     serves N city instances (see `$lib/instance.ts`), so a hardcoded "Lüneburg" would ship
 *     the wrong city to every other instance — silently, since nothing else would break.
 *
 * Deliberately NOT tested here: the `<h1>` markup changes on `/` and `/search`. Per
 * `write-tests`, component rendering has no harness in this repo and this change is not the
 * place to introduce one — those are covered by the Playwright specs instead.
 */

/** Titles Google truncates past ~60 chars; descriptions past ~155. */
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;

/** Mirrors `$lib/instance.ts`'s `city` fallback — the default instance's reference city. */
const DEFAULT_CITY = 'Lüneburg';

/**
 * Item name that must still fit inside `TITLE_MAX` alongside the fixed part of the item-detail
 * title. Expressed as a name budget rather than pinning the fixed part's exact length: pinning
 * mirrors `CITY` + `APP_NAME` into this file and fails with "expected 36 to be 31" the moment
 * either changes, even when the title is still perfectly fine. Phrased this way a failure means
 * the budget is genuinely used up — whether from padding the fixed part or from a longer city.
 */
const ITEM_NAME_BUDGET = 29;

/**
 * The indexable pages whose metadata should name the city. One row per page, so adding a new
 * SEO entry means touching one list — three parallel `it.each` blocks would let a new page slip
 * into only one of them and be silently half-tested.
 *
 * `cityInTitle: false` marks a deliberate exception: "Wie funktioniert AllerLeih?" is a brand
 * query, so the city belongs in its description only.
 */
const LOCAL_PAGES = [
	{ key: 'home', ...texts.seo.home },
	{ key: 'search', ...texts.seo.search },
	{ key: 'about', ...texts.seo.about },
	{ key: 'guide', ...texts.seo.guide, cityInTitle: false },
	{ key: 'contact', ...texts.seo.contact },
] as const;

describe('texts.seo — local SEO strings (default instance)', () => {
	it.each(LOCAL_PAGES)('$key: title names the city and fits the budget', (entry) => {
		if ('cityInTitle' in entry && entry.cityInTitle === false) {
			expect(entry.title).not.toContain(DEFAULT_CITY);
		} else {
			expect(entry.title).toContain(DEFAULT_CITY);
		}
		expect(entry.title.length).toBeLessThanOrEqual(TITLE_MAX);
	});

	it.each(LOCAL_PAGES)('$key: description names the city and fits the budget', (entry) => {
		expect(entry.description).toContain(DEFAULT_CITY);
		expect(entry.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
	});

	it('uses the city in the visible /search heading', () => {
		expect(texts.pages.search.title).toContain(DEFAULT_CITY);
	});

	describe('item detail', () => {
		it('names the city in both title and description', () => {
			expect(texts.seo.itemDetail('Bohrmaschine')).toContain(DEFAULT_CITY);
			expect(texts.seo.itemDetailDescription('Bohrmaschine', 'Anna')).toContain(DEFAULT_CITY);
		});

		it('leaves room in the title budget for a typical item name', () => {
			expect(texts.seo.itemDetail('x'.repeat(ITEM_NAME_BUDGET)).length).toBeLessThanOrEqual(
				TITLE_MAX
			);
		});
	});

	describe('item detail — owner placement', () => {
		it('keeps the owner out of the title (it costs characters and earns no ranking)', () => {
			expect(texts.seo.itemDetail('Bohrmaschine')).not.toContain('Anna');
		});

		it('names both item and owner in the description', () => {
			const description = texts.seo.itemDetailDescription('Bohrmaschine', 'Anna');
			expect(description).toContain('Bohrmaschine');
			expect(description).toContain('Anna');
		});
	});
});

describe('texts.seo — city is interpolated, not hardcoded', () => {
	beforeEach(() => vi.resetModules());
	afterEach(() => vi.doUnmock('$env/dynamic/public'));

	/**
	 * Walks every string reachable under `texts.seo`, calling functions with placeholder args.
	 *
	 * Scoped to `texts.seo` on purpose — NOT because `texts.pages.imprint.address.city` is
	 * exempt from per-instance configuration (since #629 it IS configurable, via its own
	 * `PUBLIC_IMPRINT_CITY`, independently of the browsing `CITY`/`PUBLIC_INSTANCE_CITY` this
	 * file's walk is about), but because a repo-wide walk would break on unrelated shapes under
	 * `texts.pages` (arrays, multi-arg functions) for no benefit — `instance.test.ts` already
	 * covers the imprint/social/team denylist directly, and `texts.pages.imprint`/`texts.names`
	 * get their own narrow walk below.
	 *
	 * Assumes every function under `texts.seo` takes 1–2 string args — it calls each with
	 * `('X', 'Y')` regardless of arity. Adding a 3-arg entry will fail this test with an opaque
	 * runtime error (wrong argument, `undefined` in the output, etc.); if that happens, extend
	 * the call here rather than debugging the entry itself.
	 */
	function collectSeoStrings(node: unknown): string[] {
		if (typeof node === 'string') return [node];
		if (typeof node === 'function') {
			const produced = (node as (...args: string[]) => unknown)('X', 'Y');
			// Fail loudly instead of returning []: an entry that doesn't yield a string would
			// otherwise drop out of the hardcoding guard below without anyone noticing.
			if (typeof produced !== 'string') {
				throw new Error(
					`texts.seo contains a function returning ${typeof produced}; extend collectSeoStrings() so it stays covered by the hardcoded-city guard.`
				);
			}
			return [produced];
		}
		if (node && typeof node === 'object') return Object.values(node).flatMap(collectSeoStrings);
		return [];
	}

	it('renders every seo string with the configured city and no trace of the default', async () => {
		vi.doMock('$env/dynamic/public', () => ({ env: { PUBLIC_INSTANCE_CITY: 'Marburg' } }));
		const { texts: overridden } = await import('./texts');

		const strings = collectSeoStrings(overridden.seo);
		expect(strings.length).toBeGreaterThan(0);
		// The regression this whole file exists for: any future hardcoded "Lüneburg" anywhere
		// under `texts.seo` fails here, not just in the keys this change happened to touch.
		for (const value of strings) {
			expect(value).not.toContain(DEFAULT_CITY);
		}
		expect(strings.filter((value) => value.includes('Marburg')).length).toBeGreaterThan(0);
	});

	it('carries the configured city into the visible /search heading', async () => {
		vi.doMock('$env/dynamic/public', () => ({ env: { PUBLIC_INSTANCE_CITY: 'Marburg' } }));
		const { texts: overridden } = await import('./texts');
		expect(overridden.pages.search.title).toBe('Gegenstände leihen in Marburg');
	});
});

/**
 * `texts.pages.imprint` and `texts.names` are the two spots in `texts.ts` that surface
 * `instance.imprint`/`instance.contactEmail`/`instance.feedbackEmail` as user-facing strings
 * (issue #629) — a narrow walk, not a repo-wide one (`texts.pages` otherwise has arrays and
 * multi-arg functions that would make a generic recursive caller fragile for no benefit; see the
 * doc comment on `collectSeoStrings` above for why the SEO walk stays scoped too).
 */
describe('texts.pages.imprint / texts.names — no hardcoded flagship literals for a non-flagship instance', () => {
	beforeEach(() => vi.resetModules());
	afterEach(() => vi.doUnmock('$env/dynamic/public'));

	function collectStrings(node: unknown): string[] {
		if (typeof node === 'string') return [node];
		if (node && typeof node === 'object') return Object.values(node).flatMap(collectStrings);
		return [];
	}

	it('leaks no flagship-operator data for a fully-configured non-flagship instance', async () => {
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
			},
		}));
		const { texts: overridden } = await import('./texts');

		const strings = [
			...collectStrings(overridden.pages.imprint),
			...collectStrings(overridden.names),
		];
		expect(strings.length).toBeGreaterThan(0);
		for (const forbidden of ['Lüneburg', 'AllerLeih e.V.', 'VR 202438', 'allerleih.org']) {
			for (const value of strings) {
				expect(value).not.toContain(forbidden);
			}
		}
	});
});
