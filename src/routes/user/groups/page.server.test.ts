import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from './+page.server';
import { texts } from '$lib/texts';

const ME = 'me';

// Action results are a union (ActionFailure | …); read fail fields loosely.
const r = (x: unknown) => x as { status?: number; data?: Record<string, unknown> };

function req(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.append(k, v);
	return { formData: () => Promise.resolve(fd) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeLocals(collections: Record<string, any>) {
	return {
		user: { id: ME },
		pb: {
			filter: (raw: string) => raw,
			collection: vi.fn((name: string) => collections[name] ?? {}),
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

beforeEach(() => vi.clearAllMocks());

describe('groups overview — create', () => {
	it('fails when the name is blank', async () => {
		const create = vi.fn();
		const locals = makeLocals({ groups: { create } });
		const res = await actions.create({ locals, request: req({ name: '   ', description: 'x' }) } as never);
		expect(r(res).status).toBe(400);
		expect(r(res).data).toMatchObject({ message: texts.groups.nameRequired });
		expect(create).not.toHaveBeenCalled();
	});

	it('creates a group owned by the current user', async () => {
		const create = vi.fn().mockResolvedValue({ id: 'g1' });
		const locals = makeLocals({ groups: { create } });
		const res = await actions.create({
			locals,
			request: req({ name: '  Nachbarschaft Nord  ', description: ' Werkzeug ' }),
		} as never);
		expect(res).toMatchObject({ success: true });
		// trims name/description and sets the owner to the current user
		expect(create).toHaveBeenCalledWith({
			name: 'Nachbarschaft Nord',
			description: 'Werkzeug',
			owner: ME,
		});
	});
});

describe('groups overview — leave', () => {
	it('fails without a groupId', async () => {
		const locals = makeLocals({ group_members: {} });
		const res = await actions.leave({ locals, request: req({}) } as never);
		expect(r(res).status).toBe(400);
		expect(r(res).data).toMatchObject({ message: texts.errors.missingId });
	});

	it('deletes the current user membership row for the group', async () => {
		const del = vi.fn().mockResolvedValue(true);
		const locals = makeLocals({
			group_members: {
				getFirstListItem: vi.fn().mockResolvedValue({ id: 'm1' }),
				delete: del,
			},
		});
		const res = await actions.leave({ locals, request: req({ groupId: 'g1' }) } as never);
		expect(res).toMatchObject({ success: true });
		expect(del).toHaveBeenCalledWith('m1');
	});
});
