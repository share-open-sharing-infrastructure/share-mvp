import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fetchItemStatus } = vi.hoisted(() => ({ fetchItemStatus: vi.fn() }));

vi.mock('./client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./client')>();
	return { ...actual, fetchItemStatus };
});

import { winbiapRefreshIntegration, isWinbiapItem } from './index';
import type { ExistingItem, Institution } from '../core/types';

function existingItem(overrides: Partial<ExistingItem> = {}): ExistingItem {
	return {
		id: 'pb-1',
		externalId: '118$60449822',
		name: 'Bohrmaschine',
		description: 'desc',
		status: 'available',
		categories: ['Werkzeug und Garten'],
		externalImgUrl: '',
		externalUrl: 'https://rblg.stadt.lueneburg.de/webopac/detail.aspx?data=x',
		place: 'Marienplatz',
		...overrides,
	};
}

const institution = { id: 'inst1', username: 'ratsbuecherei', leihbackendUrl: 'https://rblg.stadt.lueneburg.de/webopac' } as Institution & { leihbackendUrl: string };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('isWinbiapItem', () => {
	it('claims items whose externalUrl contains /webopac/', () => {
		expect(isWinbiapItem(existingItem({ externalId: 'rec1', externalUrl: 'https://x/webopac/detail.aspx?d=1' }))).toBe(true);
	});

	it('claims items whose externalId contains $ (API-miss items have an empty externalUrl)', () => {
		expect(isWinbiapItem(existingItem({ externalUrl: '' }))).toBe(true);
	});

	it('does not claim a plain leihbackend item', () => {
		expect(isWinbiapItem(existingItem({ externalId: 'abc123def456ghi', externalUrl: 'https://allerlei.uber.space/x' }))).toBe(false);
	});
});

describe('winbiapRefreshIntegration.fetchOne', () => {
	it('produces a status-only update on a hit, preserving the item fields', async () => {
		fetchItemStatus.mockResolvedValue({ found: true, status: 'unavailable' });
		const item = existingItem({ status: 'available' });

		const outcome = await winbiapRefreshIntegration.fetchOne(institution, item);

		expect(fetchItemStatus).toHaveBeenCalledWith('https://rblg.stadt.lueneburg.de/webopac', '118$60449822');
		expect(outcome.kind).toBe('found');
		if (outcome.kind === 'found') {
			expect(outcome.item).toMatchObject({
				externalId: '118$60449822',
				name: 'Bohrmaschine',
				status: 'unavailable', // only status changed
				place: 'Marienplatz',
			});
		}
	});

	it('reports gone when the catalogue has no such item', async () => {
		fetchItemStatus.mockResolvedValue({ found: false });

		const outcome = await winbiapRefreshIntegration.fetchOne(institution, existingItem());

		expect(outcome.kind).toBe('gone');
	});

	it('propagates a transient fetch error (handled as error by the refresh flow)', async () => {
		fetchItemStatus.mockRejectedValue(new Error('timeout'));

		await expect(winbiapRefreshIntegration.fetchOne(institution, existingItem())).rejects.toThrow('timeout');
	});

	it('has the expected id', () => {
		expect(winbiapRefreshIntegration.id).toBe('winbiap');
	});
});
