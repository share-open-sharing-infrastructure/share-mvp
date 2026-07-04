import { describe, it, expect, vi } from 'vitest';
import { findSyncInstitutions } from './pocketbase';
import type { SyncInstitution } from './types';

const BASE_FILTER = 'isInstitution = true && leihbackendUrl != ""';
const FIELDS = 'id,username,city,leihbackendUrl,leihbackendItemUrlTemplate';

function institution(id: string): SyncInstitution {
	return { id, username: `inst-${id}`, city: 'Lüneburg', leihbackendUrl: 'https://x/webopac' };
}

function makeMockPb(users: SyncInstitution[]) {
	const getFullList = vi.fn().mockResolvedValue(users);
	// Mirror pocketbase's filter binding: substitute {:id} with the quoted param.
	const filter = vi.fn((expr: string, params: Record<string, string>) =>
		expr.replace('{:id}', `"${params.id}"`)
	);
	const pb = {
		collection: vi.fn((name: string) => {
			if (name === 'users') return { getFullList };
			throw new Error(`unexpected collection: ${name}`);
		}),
		filter,
	};
	return { pb: pb as never, getFullList, filter };
}

describe('findSyncInstitutions', () => {
	it('queries all sync-configured institutions with the field projection (no id)', async () => {
		const { pb, getFullList, filter } = makeMockPb([institution('i1')]);

		const result = await findSyncInstitutions(pb);

		expect(filter).not.toHaveBeenCalled();
		expect(getFullList).toHaveBeenCalledWith({ filter: BASE_FILTER, fields: FIELDS });
		expect(result.map((i) => i.id)).toEqual(['i1']);
	});

	it('restricts to a single institution via a parameterized id filter', async () => {
		const { pb, getFullList, filter } = makeMockPb([institution('inst9')]);

		await findSyncInstitutions(pb, 'inst9');

		expect(filter).toHaveBeenCalledWith(`${BASE_FILTER} && id = {:id}`, { id: 'inst9' });
		expect(getFullList.mock.calls[0][0].filter).toContain('inst9');
		expect(getFullList.mock.calls[0][0].fields).toBe(FIELDS);
	});
});
