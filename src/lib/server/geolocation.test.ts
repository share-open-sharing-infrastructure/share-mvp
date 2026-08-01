import { describe, it, expect, vi } from 'vitest';
import { makeMockPb } from '$lib/test-utils/pocketbase';
import { upsertUserGeolocation } from './geolocation';

const COLLECTION = 'user_geolocations';

/** A PocketBase-shaped rejection: what matters to the guards is the `status` field. */
function pbError(status: number, message = `status ${status}`) {
	return Object.assign(new Error(message), { status });
}

/** `getFirstListItem` answers "no match" with a 404 — that's how the row lookup sees "none". */
const NO_ROW = pbError(404, 'no rows');

function makePb(getFirstListItem: ReturnType<typeof vi.fn>, del = vi.fn().mockResolvedValue(true)) {
	return { pb: makeMockPb({ [COLLECTION]: { getFirstListItem, delete: del } }), del };
}

describe('upsertUserGeolocation — clear path (geo === null)', () => {
	it('deletes the stored row when the user empties the address', async () => {
		const { pb, del } = makePb(vi.fn().mockResolvedValue({ id: 'geo1' }));
		await upsertUserGeolocation(pb, 'u1', null);
		expect(del).toHaveBeenCalledWith('geo1');
	});

	it('no-ops when the user never stored a location', async () => {
		const { pb, del } = makePb(vi.fn().mockRejectedValue(NO_ROW));
		await expect(upsertUserGeolocation(pb, 'u1', null)).resolves.toBeUndefined();
		expect(del).not.toHaveBeenCalled();
	});

	it('does not throw when a concurrent clear already removed the row (#612)', async () => {
		// Two ?/saveProfile submits with an empty address resolve the same row id; the
		// loser's delete 404s even though "no geolocation row" is the desired end state.
		const { pb } = makePb(
			vi.fn().mockResolvedValueOnce({ id: 'geo1' }).mockRejectedValueOnce(NO_ROW),
			vi.fn().mockRejectedValue(pbError(404, 'Not Found'))
		);
		await expect(upsertUserGeolocation(pb, 'u1', null)).resolves.toBeUndefined();
	});

	it('surfaces a failed row lookup instead of silently skipping the delete', async () => {
		// A 500 must not read as "no location stored" — that would report a successful
		// clear while the coordinates stay in the database.
		const { pb, del } = makePb(vi.fn().mockRejectedValue(pbError(500, 'Server Error')));
		await expect(upsertUserGeolocation(pb, 'u1', null)).rejects.toThrow('Server Error');
		expect(del).not.toHaveBeenCalled();
	});
});
