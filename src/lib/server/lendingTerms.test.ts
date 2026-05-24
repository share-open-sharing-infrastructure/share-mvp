import { describe, it, expect, vi, beforeEach } from 'vitest';
import type PocketBase from 'pocketbase';
import { cleanTermsHtml, getActiveTerms, getAcceptance, hasAcceptedActiveTerms } from './lendingTerms';
import type { LendingTerms, TermAcceptance } from '$lib/types/models';

// ---------------------------------------------------------------------------
// cleanTermsHtml — pure function
// ---------------------------------------------------------------------------

describe('cleanTermsHtml', () => {
	it('returns empty string for null', () => expect(cleanTermsHtml(null)).toBe(''));
	it('returns empty string for undefined', () => expect(cleanTermsHtml(undefined)).toBe(''));
	it('returns empty string for empty string', () => expect(cleanTermsHtml('')).toBe(''));

	describe('style attribute stripping', () => {
		it('removes double-quoted style attributes', () => {
			expect(cleanTermsHtml('<p style="color: red; font-size: 14px">text</p>')).toBe(
				'<p>text</p>'
			);
		});

		it('removes single-quoted style attributes', () => {
			expect(cleanTermsHtml("<p style='color: red'>text</p>")).toBe('<p>text</p>');
		});

		it('removes style attribute with empty value', () => {
			expect(cleanTermsHtml('<span style="">text</span>')).toBe('text');
		});

		it('removes multiple style attributes in one string', () => {
			expect(
				cleanTermsHtml('<p style="color:red">a</p><div style="margin:0">b</div>')
			).toBe('<p>a</p><div>b</div>');
		});
	});

	describe('span unwrapping', () => {
		it('removes bare span tags', () => {
			expect(cleanTermsHtml('<span>text</span>')).toBe('text');
		});

		it('trims whitespace inside spans', () => {
			expect(cleanTermsHtml('<span>  padded  </span>')).toBe('padded');
		});

		it('unwraps span while preserving inner HTML elements', () => {
			// The inner <strong> is not a plain span, so it stays
			expect(cleanTermsHtml('<span><strong>bold</strong></span>')).toBe('<strong>bold</strong>');
		});
	});

	describe('markdown link conversion', () => {
		it('converts [label](url) to an anchor tag', () => {
			expect(cleanTermsHtml('[Datenschutz](https://example.com/privacy)')).toBe(
				'<a href="https://example.com/privacy">Datenschutz</a>'
			);
		});

		it('converts multiple links in one string', () => {
			const input = '[A](https://a.com) und [B](https://b.com)';
			expect(cleanTermsHtml(input)).toBe(
				'<a href="https://a.com">A</a> und <a href="https://b.com">B</a>'
			);
		});

		it('leaves plain URLs without brackets untouched', () => {
			expect(cleanTermsHtml('https://example.com')).toBe('https://example.com');
		});
	});

	describe('markdown heading conversion', () => {
		it('converts <div># Heading</div> to <h2>', () => {
			expect(cleanTermsHtml('<div># Titel</div>')).toBe('<h2>Titel</h2>');
		});

		it('converts <div>## Heading</div> to <h3>', () => {
			expect(cleanTermsHtml('<div>## Abschnitt</div>')).toBe('<h3>Abschnitt</h3>');
		});

		it('converts <div>### Heading</div> to <h4>', () => {
			expect(cleanTermsHtml('<div>### Unterabschnitt</div>')).toBe('<h4>Unterabschnitt</h4>');
		});

		it('does not convert ### inside non-div elements', () => {
			// Inline markdown outside a div should remain untouched
			expect(cleanTermsHtml('<p>### not a heading</p>')).toBe('<p>### not a heading</p>');
		});

		it('handles whitespace between div tag and hashes', () => {
			expect(cleanTermsHtml('<div>  ## Spaced  </div>')).toBe('<h3>Spaced</h3>');
		});

		it('does not misidentify ### as ##', () => {
			// ### is processed first and must not produce an extra h3
			expect(cleanTermsHtml('<div>### Foo</div>')).toBe('<h4>Foo</h4>');
		});
	});

	describe('trailing <br> collapsing', () => {
		it('removes <br> immediately after </div>', () => {
			expect(cleanTermsHtml('<div>text</div><br>')).toBe('<div>text</div>');
		});

		it('removes self-closing <br/> after </p>', () => {
			expect(cleanTermsHtml('<p>text</p><br/>')).toBe('<p>text</p>');
		});

		it('removes <br> after list elements', () => {
			expect(cleanTermsHtml('<li>item</li><br>')).toBe('<li>item</li>');
		});

		it('does not remove <br> inside inline content', () => {
			// <br> inside a <p> (preceded by text, not a closing block tag) should stay
			expect(cleanTermsHtml('<p>line one<br>line two</p>')).toBe('<p>line one<br>line two</p>');
		});
	});

	describe('output trimming', () => {
		it('trims leading and trailing whitespace', () => {
			expect(cleanTermsHtml('  <p>text</p>  ')).toBe('<p>text</p>');
		});
	});

	describe('combined transformations', () => {
		it('applies all transformations in order', () => {
			const input =
				'<div style="color:red">## <span style="font-weight:bold">Abschnitt</span></div><br>';
			// 1. style stripped → <div>## <span>Abschnitt</span></div><br>
			// 2. span unwrapped → <div>## Abschnitt</div><br>
			// 3. ## → h3       → <h3>Abschnitt</h3><br>  (wait — ## regex only matches inside <div>)
			// Actually after span unwrap we have <div>## Abschnitt</div><br>
			// Then ## heading: <h3>Abschnitt</h3><br>
			// Then br after block: <h3>Abschnitt</h3>
			expect(cleanTermsHtml(input)).toBe('<h3>Abschnitt</h3>');
		});
	});
});

// ---------------------------------------------------------------------------
// Helpers for DB tests
// ---------------------------------------------------------------------------

function makeMockPb(collectionImpl: (name: string) => object): PocketBase {
	return { collection: vi.fn((name: string) => collectionImpl(name)) } as unknown as PocketBase;
}

const stubTerms: LendingTerms = {
	id: 'terms1',
	created: '2025-01-01T00:00:00Z',
	updated: '2025-01-01T00:00:00Z',
	owner: 'owner1',
	version: '1.0',
	title: 'Leihbedingungen',
	body: '<p>Terms text</p>',
	effectiveFrom: '2025-01-01T00:00:00Z',
	active: true,
	minAge: 18
};

const stubAcceptance: TermAcceptance = {
	id: 'acc1',
	created: '2025-06-01T00:00:00Z',
	updated: '2025-06-01T00:00:00Z',
	user: 'user1',
	terms: 'terms1',
	acceptedAt: '2025-06-01T00:00:00Z',
	confirmedAdult: true,
	fullNameSnapshot: 'Max Mustermann',
	termsBody: '<p>Terms text</p>'
};

// ---------------------------------------------------------------------------
// getActiveTerms
// ---------------------------------------------------------------------------

describe('getActiveTerms', () => {
	let mockGetFirstListItem: ReturnType<typeof vi.fn>;
	let pb: PocketBase;

	beforeEach(() => {
		mockGetFirstListItem = vi.fn();
		pb = makeMockPb(() => ({ getFirstListItem: mockGetFirstListItem }));
	});

	it('returns the record when PocketBase resolves', async () => {
		mockGetFirstListItem.mockResolvedValue(stubTerms);
		const result = await getActiveTerms(pb, 'owner1');
		expect(result).toEqual(stubTerms);
	});

	it('returns null when PocketBase throws (e.g. 404 no match)', async () => {
		mockGetFirstListItem.mockRejectedValue(new Error('404'));
		const result = await getActiveTerms(pb, 'owner1');
		expect(result).toBeNull();
	});

	it('queries the lending_terms collection', async () => {
		mockGetFirstListItem.mockResolvedValue(stubTerms);
		await getActiveTerms(pb, 'owner1');
		expect((pb.collection as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('lending_terms');
	});

	it('passes a filter containing the ownerId, active=true, and effectiveFrom', async () => {
		mockGetFirstListItem.mockResolvedValue(stubTerms);
		await getActiveTerms(pb, 'owner1');
		const [filter] = mockGetFirstListItem.mock.calls[0];
		expect(filter).toContain('owner = "owner1"');
		expect(filter).toContain('active = true');
		expect(filter).toMatch(/effectiveFrom <= "/);
	});

	it('sorts by -effectiveFrom', async () => {
		mockGetFirstListItem.mockResolvedValue(stubTerms);
		await getActiveTerms(pb, 'owner1');
		const [, options] = mockGetFirstListItem.mock.calls[0];
		expect(options).toEqual({ sort: '-effectiveFrom' });
	});
});

// ---------------------------------------------------------------------------
// getAcceptance
// ---------------------------------------------------------------------------

describe('getAcceptance', () => {
	let mockGetFirstListItem: ReturnType<typeof vi.fn>;
	let pb: PocketBase;

	beforeEach(() => {
		mockGetFirstListItem = vi.fn();
		pb = makeMockPb(() => ({ getFirstListItem: mockGetFirstListItem }));
	});

	it('returns the acceptance record when found', async () => {
		mockGetFirstListItem.mockResolvedValue(stubAcceptance);
		const result = await getAcceptance(pb, 'user1', 'terms1');
		expect(result).toEqual(stubAcceptance);
	});

	it('returns null when PocketBase throws', async () => {
		mockGetFirstListItem.mockRejectedValue(new Error('404'));
		const result = await getAcceptance(pb, 'user1', 'terms1');
		expect(result).toBeNull();
	});

	it('queries the term_acceptances collection', async () => {
		mockGetFirstListItem.mockResolvedValue(stubAcceptance);
		await getAcceptance(pb, 'user1', 'terms1');
		expect((pb.collection as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('term_acceptances');
	});

	it('passes a filter containing userId and termsId', async () => {
		mockGetFirstListItem.mockResolvedValue(stubAcceptance);
		await getAcceptance(pb, 'user1', 'terms1');
		const [filter] = mockGetFirstListItem.mock.calls[0];
		expect(filter).toContain('user = "user1"');
		expect(filter).toContain('terms = "terms1"');
	});

	it('sorts by -acceptedAt to get the most recent acceptance', async () => {
		mockGetFirstListItem.mockResolvedValue(stubAcceptance);
		await getAcceptance(pb, 'user1', 'terms1');
		const [, options] = mockGetFirstListItem.mock.calls[0];
		expect(options).toEqual({ sort: '-acceptedAt' });
	});
});

// ---------------------------------------------------------------------------
// hasAcceptedActiveTerms
// ---------------------------------------------------------------------------

describe('hasAcceptedActiveTerms', () => {
	function makePbWith(
		termsResult: LendingTerms | Error,
		acceptanceResult?: TermAcceptance | Error
	): PocketBase {
		const termsGet = vi.fn().mockImplementation(() =>
			termsResult instanceof Error ? Promise.reject(termsResult) : Promise.resolve(termsResult)
		);
		const acceptanceGet = vi.fn().mockImplementation(() => {
			if (!acceptanceResult) return Promise.reject(new Error('404'));
			return acceptanceResult instanceof Error
				? Promise.reject(acceptanceResult)
				: Promise.resolve(acceptanceResult);
		});
		return makeMockPb((name) => ({
			getFirstListItem: name === 'lending_terms' ? termsGet : acceptanceGet
		}));
	}

	it('returns true when there are no active terms (nothing to accept)', async () => {
		const pb = makePbWith(new Error('404'));
		expect(await hasAcceptedActiveTerms(pb, 'user1', 'owner1')).toBe(true);
	});

	it('returns true when the user has accepted the active terms', async () => {
		const pb = makePbWith(stubTerms, stubAcceptance);
		expect(await hasAcceptedActiveTerms(pb, 'user1', 'owner1')).toBe(true);
	});

	it('returns false when the user has not accepted the active terms', async () => {
		const pb = makePbWith(stubTerms /* no acceptance */);
		expect(await hasAcceptedActiveTerms(pb, 'user1', 'owner1')).toBe(false);
	});

	it('looks up acceptance using the id of the active terms record', async () => {
		const acceptanceGet = vi.fn().mockResolvedValue(stubAcceptance);
		const pb = makeMockPb((name) => ({
			getFirstListItem:
				name === 'lending_terms'
					? vi.fn().mockResolvedValue(stubTerms)
					: acceptanceGet
		}));
		await hasAcceptedActiveTerms(pb, 'user1', 'owner1');
		const [filter] = acceptanceGet.mock.calls[0];
		expect(filter).toContain(`terms = "${stubTerms.id}"`);
	});
});
