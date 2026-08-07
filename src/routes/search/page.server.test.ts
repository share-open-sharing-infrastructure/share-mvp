import { describe, it, expect, vi, beforeEach } from 'vitest';

// The load calls getAttachableGroups (the membership source of truth) to both feed the
// dropdown and authorize the `group` param. Mock it so the leak-guard wiring is testable
// without a real PocketBase.
const { getAttachableGroupsMock } = vi.hoisted(() => ({ getAttachableGroupsMock: vi.fn() }));
vi.mock('$lib/server/groups', () => ({ getAttachableGroups: getAttachableGroupsMock }));
// +page.server re-exports PUBLIC_PB_URL from hooks.server, which reads it from $env at import.
vi.mock('$env/static/public', () => ({ PUBLIC_PB_URL: 'http://localhost', PUBLIC_VAPID_PUBLIC_KEY: 'x' }));

import { load } from './+page.server';

// A well-formed 15-char PocketBase record id (survives parseSearchParameters' shape check).
const MEMBER_GROUP = 'abcdefghij01234';
const FOREIGN_GROUP = 'zyxwvutsrq98765';

type LoadResult = Awaited<ReturnType<typeof load>>;

function makeLocals(user: { id: string } | null) {
	const getList = vi.fn().mockResolvedValue({ page: 1, perPage: 20, totalItems: 0, totalPages: 0, items: [] });
	const create = vi.fn().mockResolvedValue({});
	const collection = vi.fn((name: string) => {
		if (name === 'items_searchable') return { getList };
		if (name === 'searches') return { create };
		return {};
	});
	return { locals: { pb: { collection }, user }, getList, create };
}

function run(locals: unknown, search = ''): Promise<LoadResult> {
	const url = new URL(`http://x/search${search}`);
	return load({ locals, url } as never);
}

beforeEach(() => vi.clearAllMocks());

describe('search load — group filter', () => {
	it('applies a membership-validated group id to the getList filter and returns it', async () => {
		getAttachableGroupsMock.mockResolvedValue([{ id: MEMBER_GROUP, name: 'Nachbarschaft', isPublic: false }]);
		const { locals, getList } = makeLocals({ id: 'u1' });

		const res = await run(locals, `?group=${MEMBER_GROUP}`);

		const opts = getList.mock.calls[0][2];
		expect(opts.filter).toContain(`groups ~ "${MEMBER_GROUP}"`);
		expect(res.selectedGroup).toBe(MEMBER_GROUP);
		// Only id + name reach the client — never the item's `groups` column.
		expect(res.attachableGroups).toEqual([{ id: MEMBER_GROUP, name: 'Nachbarschaft' }]);
	});

	it('silently drops a foreign group id (leak guard): no group clause, selectedGroup null', async () => {
		// The user is a member of a different group than the one in the URL.
		getAttachableGroupsMock.mockResolvedValue([{ id: MEMBER_GROUP, name: 'Nachbarschaft', isPublic: false }]);
		const { locals, getList } = makeLocals({ id: 'u1' });

		const res = await run(locals, `?group=${FOREIGN_GROUP}`);

		const opts = getList.mock.calls[0][2];
		expect(opts.filter ?? '').not.toContain('groups');
		expect(res.selectedGroup).toBeNull();
	});

	it('ignores the param for guests and never calls getAttachableGroups', async () => {
		const { locals, getList } = makeLocals(null);

		const res = await run(locals, `?group=${MEMBER_GROUP}`);

		expect(getAttachableGroupsMock).not.toHaveBeenCalled();
		expect(res.attachableGroups).toEqual([]);
		expect(res.selectedGroup).toBeNull();
		const opts = getList.mock.calls[0][2];
		expect(opts.filter ?? '').not.toContain('groups');
	});

	it('never returns the items.groups column via the fields allowlist (leak regression)', async () => {
		getAttachableGroupsMock.mockResolvedValue([{ id: MEMBER_GROUP, name: 'Nachbarschaft', isPublic: false }]);
		const { locals, getList } = makeLocals({ id: 'u1' });

		await run(locals, `?group=${MEMBER_GROUP}`);

		const opts = getList.mock.calls[0][2];
		expect(opts.fields).toBeTruthy();
		expect(opts.fields).toContain('status');
		expect(opts.fields).not.toContain('groups');
	});

	it('does not log to searches when only a group is selected (no q/cats)', async () => {
		getAttachableGroupsMock.mockResolvedValue([{ id: MEMBER_GROUP, name: 'Nachbarschaft', isPublic: false }]);
		const { locals, create } = makeLocals({ id: 'u1' });

		await run(locals, `?group=${MEMBER_GROUP}`);

		expect(create).not.toHaveBeenCalled();
	});

	it('logs the query but never the group id when q + group are combined', async () => {
		getAttachableGroupsMock.mockResolvedValue([{ id: MEMBER_GROUP, name: 'Nachbarschaft', isPublic: false }]);
		const { locals, create } = makeLocals({ id: 'u1' });

		await run(locals, `?q=zelt&group=${MEMBER_GROUP}`);

		expect(create).toHaveBeenCalledTimes(1);
		const payload = create.mock.calls[0][0];
		expect(payload).toEqual({ query: 'zelt', categories: '' });
		// The private social-graph datum must not leak into the analytics log.
		expect(JSON.stringify(payload)).not.toContain(MEMBER_GROUP);
	});
});

describe('search load — sort', () => {
	it.each([
		['newest', '-created'],
		['name_asc', 'name'],
		['name_desc', '-name'],
	])('maps sort=%s to getList sort "%s"', async (sortParam, pbSort) => {
		getAttachableGroupsMock.mockResolvedValue([]);
		const { locals, getList } = makeLocals(null);

		const res = await run(locals, `?sort=${sortParam}`);

		const opts = getList.mock.calls[0][2];
		expect(opts.sort).toBe(pbSort);
		expect(res.sort).toBe(sortParam);
	});

	it('defaults to -created when sort is absent', async () => {
		getAttachableGroupsMock.mockResolvedValue([]);
		const { locals, getList } = makeLocals(null);

		await run(locals, '');

		const opts = getList.mock.calls[0][2];
		expect(opts.sort).toBe('-created');
	});

	it('defaults to -created when sort is invalid', async () => {
		getAttachableGroupsMock.mockResolvedValue([]);
		const { locals, getList } = makeLocals(null);

		await run(locals, '?sort=bogus');

		const opts = getList.mock.calls[0][2];
		expect(opts.sort).toBe('-created');
	});
});
