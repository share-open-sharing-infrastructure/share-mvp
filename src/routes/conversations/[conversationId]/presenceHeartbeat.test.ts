import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startPresenceHeartbeat } from './presenceHeartbeat';

function makePb(update: ReturnType<typeof vi.fn>) {
	return { collection: vi.fn(() => ({ update })) } as never;
}

describe('startPresenceHeartbeat', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('document', { visibilityState: 'visible' });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('pings immediately on start, with the exact given field', () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const pb = makePb(update);

		const stop = startPresenceHeartbeat(pb, 'conv1', 'ownerLastSeenAt');

		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith('conv1', { ownerLastSeenAt: expect.any(String) });
		stop();
	});

	it('uses requesterLastSeenAt (not ownerLastSeenAt) when that field is requested', () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const pb = makePb(update);

		const stop = startPresenceHeartbeat(pb, 'conv1', 'requesterLastSeenAt');

		expect(update).toHaveBeenCalledWith('conv1', { requesterLastSeenAt: expect.any(String) });
		const [, payload] = update.mock.calls[0];
		expect(payload).not.toHaveProperty('ownerLastSeenAt');
		stop();
	});

	it('pings again every 15 seconds — not more, not less often', () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const pb = makePb(update);
		const stop = startPresenceHeartbeat(pb, 'conv1', 'ownerLastSeenAt');
		update.mockClear();

		vi.advanceTimersByTime(14_999);
		expect(update).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(update).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(15_000);
		expect(update).toHaveBeenCalledTimes(2);

		stop();
	});

	it('skips the ping while the document is not visible', () => {
		vi.stubGlobal('document', { visibilityState: 'hidden' });
		const update = vi.fn();
		const pb = makePb(update);

		const stop = startPresenceHeartbeat(pb, 'conv1', 'ownerLastSeenAt');
		vi.advanceTimersByTime(30_000);

		expect(update).not.toHaveBeenCalled();
		stop();
	});

	it('stops pinging once the returned cleanup function is called', () => {
		const update = vi.fn().mockResolvedValue(undefined);
		const pb = makePb(update);
		const stop = startPresenceHeartbeat(pb, 'conv1', 'ownerLastSeenAt');
		update.mockClear();

		stop();
		vi.advanceTimersByTime(60_000);

		expect(update).not.toHaveBeenCalled();
	});
});
