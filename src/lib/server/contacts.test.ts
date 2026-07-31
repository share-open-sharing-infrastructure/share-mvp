import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';
import { getOwnContact, upsertOwnContact, type UserContact } from './contacts';

// Wiring regression for issue #558's failure mode 2 (non-atomic upsertOwnContact). The
// create-race guard itself already lives in — and is already covered by —
// upsertSingletonRow (src/lib/server/singletonRow.ts, src/lib/server/singletonRow.test.ts,
// landed in #586); these tests just pin that upsertOwnContact still delegates to it with the
// right find/createData/patch, modeled on singletonRow.test.ts's own cases.

const USER_ID = 'u1';

const CONTACT: UserContact = {
	telegramUsername: 'someone',
	signalLink: 'https://signal.me/#p/+491234567',
	telegramVisibleToTrustedOnly: true,
	signalVisibleToTrustedOnly: false,
};

describe('upsertOwnContact', () => {
	beforeEach(() => vi.clearAllMocks());

	it('updates the existing contact row (find resolves ⇒ update, no create)', async () => {
		const getFirstListItem = vi.fn().mockResolvedValue({ id: 'row1' });
		const update = vi.fn().mockResolvedValue({ id: 'row1' });
		const create = vi.fn();
		const pb = makeMockPb({
			user_contacts: { getFirstListItem, update, create },
		});

		await upsertOwnContact(pb, USER_ID, CONTACT);

		expect(update).toHaveBeenCalledWith('row1', CONTACT);
		expect(create).not.toHaveBeenCalled();
	});

	it('creates the row on first save (find rejects ⇒ create)', async () => {
		const getFirstListItem = vi.fn().mockRejectedValue(new Error('not found'));
		const create = vi.fn().mockResolvedValue({ id: 'new' });
		const update = vi.fn();
		const pb = makeMockPb({
			user_contacts: { getFirstListItem, update, create },
		});

		await upsertOwnContact(pb, USER_ID, CONTACT);

		expect(create).toHaveBeenCalledWith({ user: USER_ID, ...CONTACT });
		expect(update).not.toHaveBeenCalled();
	});

	it('survives a lost create race (#558): find rejects, then resolves; create rejects ⇒ falls back to update instead of throwing', async () => {
		// findOwnContactRow's try/catch converts the first (rejecting) getFirstListItem call
		// into `null` — "no row yet". The second call is upsertSingletonRow's retry after the
		// failed create, resolving to the row the concurrent writer just created.
		const getFirstListItem = vi
			.fn()
			.mockRejectedValueOnce(new Error('not found'))
			.mockResolvedValueOnce({ id: 'row1' });
		const create = vi.fn().mockRejectedValue(new Error('unique constraint'));
		const update = vi.fn().mockResolvedValue({ id: 'row1' });
		const pb = makeMockPb({
			user_contacts: { getFirstListItem, update, create },
		});

		await expect(
			upsertOwnContact(pb, USER_ID, CONTACT)
		).resolves.toBeUndefined();
		expect(update).toHaveBeenCalledWith('row1', CONTACT);
	});
});

describe('getOwnContact', () => {
	beforeEach(() => vi.clearAllMocks());

	it('builds its lookup filter via pb.filter, not raw string interpolation', async () => {
		const getFirstListItem = vi.fn().mockResolvedValue({
			telegramUsername: 'someone',
			signalLink: '',
			telegramVisibleToTrustedOnly: false,
			signalVisibleToTrustedOnly: true,
		});
		const pb = makeMockPb({ user_contacts: { getFirstListItem } });

		await getOwnContact(pb, USER_ID);

		expect(pb.filter).toHaveBeenCalledWith('user = {:u}', { u: USER_ID });
		expect(getFirstListItem).toHaveBeenCalledWith("user = 'u1'");
	});

	it('returns {} when no contact row exists yet, instead of throwing', async () => {
		const getFirstListItem = vi.fn().mockRejectedValue(new Error('not found'));
		const pb = makeMockPb({ user_contacts: { getFirstListItem } });

		await expect(getOwnContact(pb, USER_ID)).resolves.toEqual({});
	});
});
