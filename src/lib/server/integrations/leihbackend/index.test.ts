import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LeihbackendItem } from './mapping';

const { fetchAllItems, fetchItemById } = vi.hoisted(() => ({ fetchAllItems: vi.fn(), fetchItemById: vi.fn() }));

vi.mock('./client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./client')>();
	return { ...actual, fetchAllItems, fetchItemById };
});

import { leihbackendIntegration, leihbackendRefreshIntegration, fetchAndMapItems } from './index';
import type { ExistingItem, SyncInstitution } from '../core/types';

function makeRemoteItem(overrides: Partial<LeihbackendItem> = {}): LeihbackendItem {
	return {
		id: 'rec1',
		iid: 1,
		name: 'Bohrmaschine',
		description: '<p>Stark.</p>',
		status: 'instock',
		deposit: 0,
		images: [],
		synonyms: '',
		category: ['Heimwerken'],
		brand: '',
		model: '',
		packaging: '',
		manual: '',
		parts: 1,
		copies: 1,
		added_on: '2026-01-01 00:00:00.000Z',
		is_protected: false,
		...overrides,
	};
}

const institution: SyncInstitution = {
	id: 'inst1',
	username: 'commons-zentrum',
	city: 'Lüneburg',
	leihbackendUrl: 'https://allerlei.uber.space',
};

function makeMockPb(users: unknown[] = [], items: unknown[] = []) {
	const batchCalls: Array<{ method: string; data?: unknown }> = [];
	const batch = {
		collection: () => ({
			create: (data: unknown) => batchCalls.push({ method: 'create', data }),
			update: (id: string, data: unknown) => batchCalls.push({ method: 'update', data: { id, ...(data as object) } }),
		}),
		send: vi.fn().mockResolvedValue(undefined),
	};
	const usersGetFullList = vi.fn().mockResolvedValue(users);
	const itemsGetFullList = vi.fn().mockResolvedValue(items);
	const pb = {
		collection: vi.fn((name: string) => {
			if (name === 'users') return { getFullList: usersGetFullList };
			if (name === 'items') return { getFullList: itemsGetFullList };
			if (name === '_superusers') return { authWithPassword: vi.fn().mockResolvedValue({}) };
			throw new Error(`unexpected collection: ${name}`);
		}),
		createBatch: vi.fn(() => batch),
	};
	return { pb: pb as never, batchCalls, usersGetFullList, itemsGetFullList };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('fetchAndMapItems', () => {
	it('fetches the feed and maps records to items owned by the institution', async () => {
		fetchAllItems.mockResolvedValue([makeRemoteItem({ id: 'rec1', name: 'Bohrmaschine' })]);

		const items = await fetchAndMapItems(institution);

		expect(fetchAllItems).toHaveBeenCalledWith('https://allerlei.uber.space');
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			externalId: 'rec1',
			name: 'Bohrmaschine',
			owner: 'inst1',
			place: 'Lüneburg',
			categories: ['Werkzeug und Garten'],
		});
	});
});

describe('leihbackendIntegration.syncAll', () => {
	it('discovers institutions and syncs each (create path)', async () => {
		const { pb, batchCalls } = makeMockPb([institution], []);
		fetchAllItems.mockResolvedValue([makeRemoteItem({ id: 'rec1' })]);

		const summaries = await leihbackendIntegration.syncAll(pb);

		expect(summaries).toHaveLength(1);
		expect(summaries[0].institution).toBe('commons-zentrum');
		expect(summaries[0].created).toBe(1);
		expect(batchCalls).toHaveLength(1);
		expect(batchCalls[0].method).toBe('create');
	});

	it('has the expected id', () => {
		expect(leihbackendIntegration.id).toBe('leihbackend');
	});
});

describe('leihbackendRefreshIntegration', () => {
	const existing: ExistingItem = {
		id: 'pb-rec1',
		externalId: 'rec1',
		name: 'old name',
		description: 'old',
		status: 'unavailable',
		categories: [],
		externalImgUrl: '',
		externalUrl: '',
		place: 'Lüneburg',
	};

	it('claims any item (catch-all default)', () => {
		expect(leihbackendRefreshIntegration.claimsItem(existing)).toBe(true);
	});

	it('re-maps all fields on a hit (found)', async () => {
		fetchItemById.mockResolvedValue(makeRemoteItem({ id: 'rec1', name: 'fresh name', status: 'instock' }));

		const outcome = await leihbackendRefreshIntegration.fetchOne(institution, existing);

		expect(fetchItemById).toHaveBeenCalledWith('https://allerlei.uber.space', 'rec1');
		expect(outcome.kind).toBe('found');
		if (outcome.kind === 'found') {
			expect(outcome.item).toMatchObject({ externalId: 'rec1', name: 'fresh name', status: 'available' });
		}
	});

	it('reports gone when the record is a 404 (null)', async () => {
		fetchItemById.mockResolvedValue(null);

		const outcome = await leihbackendRefreshIntegration.fetchOne(institution, existing);

		expect(outcome.kind).toBe('gone');
	});
});
