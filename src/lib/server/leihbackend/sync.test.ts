import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DESCRIPTION_PREFIX } from '$lib/server/itemArchive';
import { LeihbackendFetchError } from './client';
import type { LeihbackendItem } from './mapping';

const { fetchAllItems } = vi.hoisted(() => ({ fetchAllItems: vi.fn() }));

vi.mock('./client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./client')>();
	return { ...actual, fetchAllItems };
});

vi.mock('pocketbase', () => {
	function MockPocketBase(this: { authStore: { isValid: boolean }; collection: () => unknown }) {
		this.authStore = { isValid: false };
		this.collection = vi.fn(() => ({
			authWithPassword: vi.fn().mockImplementation(async () => {
				this.authStore.isValid = true;
				return {};
			}),
		}));
	}
	return { default: vi.fn(MockPocketBase as unknown as new () => unknown) };
});

import PocketBase from 'pocketbase';
import { syncInstitution, syncAll, getSuperuserClient, type SyncInstitution } from './sync';

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
		category: ['Werkzeug'],
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

interface BatchCall {
	method: 'create' | 'update';
	args: unknown[];
}

function makeMockPb(existingItems: unknown[] = [], usersFullList: unknown[] = []) {
	const batchCalls: BatchCall[] = [];
	const batch = {
		collection: () => ({
			create: (...args: unknown[]) => batchCalls.push({ method: 'create', args: [args[0]] }),
			update: (...args: unknown[]) => batchCalls.push({ method: 'update', args }),
		}),
		send: vi.fn().mockResolvedValue(undefined),
	};

	const itemsGetFullList = vi.fn().mockResolvedValue(existingItems);
	const usersGetFullList = vi.fn().mockResolvedValue(usersFullList);

	const pb = {
		collection: vi.fn((name: string) => {
			if (name === 'items') return { getFullList: itemsGetFullList };
			if (name === 'users') return { getFullList: usersGetFullList };
			throw new Error(`unexpected collection: ${name}`);
		}),
		createBatch: vi.fn(() => batch),
	};

	return { pb: pb as never, batchCalls, batch, itemsGetFullList, usersGetFullList };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('syncInstitution', () => {
	it('creates new items for records with no existing externalId', async () => {
		fetchAllItems.mockResolvedValue([makeRemoteItem({ id: 'rec1' })]);
		const { pb, batchCalls } = makeMockPb([]);

		const summary = await syncInstitution(pb, institution);

		expect(summary.fetched).toBe(1);
		expect(summary.created).toBe(1);
		expect(summary.updated).toBe(0);
		expect(summary.archived).toBe(0);
		expect(batchCalls).toHaveLength(1);
		expect(batchCalls[0].method).toBe('create');
		const created = batchCalls[0].args[0] as Record<string, unknown>;
		expect(created.externalId).toBe('rec1');
		expect(created.owner).toBe('inst1');
		expect(created).not.toHaveProperty('image');
	});

	it('updates existing items whose mapped fields changed', async () => {
		fetchAllItems.mockResolvedValue([makeRemoteItem({ id: 'rec1', name: 'Neuer Name' })]);
		const { pb, batchCalls } = makeMockPb([
			{
				id: 'pbid1',
				externalId: 'rec1',
				name: 'Alter Name',
				description: 'Stark.',
				status: 'available',
				categories: ['Werkzeug und Garten'],
				externalImgUrl: '',
				externalUrl: '',
				place: 'Lüneburg',
			},
		]);

		const summary = await syncInstitution(pb, institution);

		expect(summary.updated).toBe(1);
		expect(summary.skipped).toBe(0);
		expect(batchCalls[0]).toEqual({
			method: 'update',
			args: ['pbid1', expect.objectContaining({ name: 'Neuer Name' })],
		});
	});

	it('skips items with no changes (no-op detection)', async () => {
		fetchAllItems.mockResolvedValue([makeRemoteItem({ id: 'rec1', name: 'Bohrmaschine' })]);
		const { pb, batchCalls } = makeMockPb([
			{
				id: 'pbid1',
				externalId: 'rec1',
				name: 'Bohrmaschine',
				description: 'Stark.\n\nInventarnummer: 1',
				status: 'available',
				categories: ['Werkzeug und Garten'],
				externalImgUrl: '',
				externalUrl: '',
				place: 'Lüneburg',
			},
		]);

		const summary = await syncInstitution(pb, institution);

		expect(summary.updated).toBe(0);
		expect(summary.created).toBe(0);
		expect(summary.skipped).toBe(1);
		expect(batchCalls).toHaveLength(0);
	});

	it('archives items missing from the feed', async () => {
		fetchAllItems.mockResolvedValue([]);
		const { pb, batchCalls } = makeMockPb([
			{
				id: 'pbid1',
				externalId: 'rec-gone',
				name: 'Verschwunden',
				description: 'Alte Beschreibung',
				status: 'available',
				categories: ['Sonstiges'],
				externalImgUrl: '',
				externalUrl: '',
				place: 'Lüneburg',
			},
		]);

		const summary = await syncInstitution(pb, institution);

		expect(summary.archived).toBe(1);
		expect(batchCalls).toHaveLength(1);
		expect(batchCalls[0]).toEqual({
			method: 'update',
			args: [
				'pbid1',
				{ status: 'unavailable', description: `${DESCRIPTION_PREFIX}Alte Beschreibung` },
			],
		});
	});

	it('does not re-archive items that are already archived', async () => {
		fetchAllItems.mockResolvedValue([]);
		const { pb, batchCalls } = makeMockPb([
			{
				id: 'pbid1',
				externalId: 'rec-gone',
				name: 'Verschwunden',
				description: `${DESCRIPTION_PREFIX}Alte Beschreibung`,
				status: 'unavailable',
				categories: ['Sonstiges'],
				externalImgUrl: '',
				externalUrl: '',
				place: 'Lüneburg',
			},
		]);

		const summary = await syncInstitution(pb, institution);

		expect(summary.archived).toBe(0);
		expect(summary.skipped).toBe(1);
		expect(batchCalls).toHaveLength(0);
	});

	it('un-archives a reappearing item by overwriting status and the prefixed description', async () => {
		fetchAllItems.mockResolvedValue([makeRemoteItem({ id: 'rec1', status: 'instock', description: '<p>Wieder da.</p>' })]);
		const { pb, batchCalls } = makeMockPb([
			{
				id: 'pbid1',
				externalId: 'rec1',
				name: 'Bohrmaschine',
				description: `${DESCRIPTION_PREFIX}Alte Beschreibung`,
				status: 'unavailable',
				categories: ['Werkzeug und Garten'],
				externalImgUrl: '',
				externalUrl: '',
				place: 'Lüneburg',
			},
		]);

		const summary = await syncInstitution(pb, institution);

		expect(summary.updated).toBe(1);
		expect(summary.archived).toBe(0);
		const updateData = batchCalls[0].args[1] as Record<string, unknown>;
		expect(updateData.status).toBe('available');
		expect(updateData.description).not.toContain(DESCRIPTION_PREFIX);
	});

	it('makes zero writes when fetching the feed fails', async () => {
		fetchAllItems.mockRejectedValue(new LeihbackendFetchError('boom', institution.leihbackendUrl));
		const { pb, batchCalls, itemsGetFullList } = makeMockPb([{ id: 'pbid1', externalId: 'rec1' }]);

		const summary = await syncInstitution(pb, institution);

		expect(summary.fetched).toBe(0);
		expect(summary.created).toBe(0);
		expect(summary.updated).toBe(0);
		expect(summary.archived).toBe(0);
		expect(summary.errors.length).toBeGreaterThan(0);
		expect(itemsGetFullList).not.toHaveBeenCalled();
		expect(batchCalls).toHaveLength(0);
	});
});

describe('syncAll', () => {
	it('finds institutions with isInstitution=true and a configured leihbackendUrl', async () => {
		fetchAllItems.mockResolvedValue([]);
		const { pb, usersGetFullList } = makeMockPb([], [institution]);

		await syncAll(pb);

		expect(usersGetFullList).toHaveBeenCalledWith(
			expect.objectContaining({ filter: 'isInstitution = true && leihbackendUrl != ""' })
		);
	});

	it("isolates one institution's failure from the next", async () => {
		const institutionB: SyncInstitution = { ...institution, id: 'inst2', username: 'mosaique' };

		fetchAllItems
			.mockRejectedValueOnce(new LeihbackendFetchError('down', institution.leihbackendUrl))
			.mockResolvedValueOnce([makeRemoteItem({ id: 'rec1' })]);

		const { pb } = makeMockPb([], [institution, institutionB]);

		const summaries = await syncAll(pb);

		expect(summaries).toHaveLength(2);
		expect(summaries[0].institution).toBe('commons-zentrum');
		expect(summaries[0].errors.length).toBeGreaterThan(0);
		expect(summaries[1].institution).toBe('mosaique');
		expect(summaries[1].errors).toHaveLength(0);
		expect(summaries[1].created).toBe(1);
	});
});

describe('getSuperuserClient', () => {
	it('caches the authenticated client across calls', async () => {
		const first = await getSuperuserClient();
		const second = await getSuperuserClient();

		expect(first).toBe(second);
		expect(PocketBase).toHaveBeenCalledTimes(1);
	});
});
