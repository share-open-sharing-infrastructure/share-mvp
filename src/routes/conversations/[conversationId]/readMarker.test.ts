import { describe, it, expect, vi } from 'vitest';
import { createReadMarker } from './readMarker';

const CONV = 'conv1';

/** A `post` stub whose promises are settled by the test, one call at a time. */
function deferredPost() {
	const calls: string[] = [];
	const settlers: Array<{ resolve: () => void; reject: () => void }> = [];
	const post = vi.fn((id: string) => {
		calls.push(id);
		return new Promise<void>((resolve, reject) => {
			settlers.push({
				resolve: () => resolve(),
				reject: () => reject(new Error('boom')),
			});
		});
	});
	return {
		post,
		calls,
		/** Settles the oldest unsettled request and lets the marker's `.finally` run. */
		async settle(mode: 'resolve' | 'reject' = 'resolve') {
			const next = settlers.shift();
			if (!next) throw new Error('no in-flight request to settle');
			next[mode]();
			// Three microtask ticks drain fire()'s chain after post()'s promise settles above:
			// (1) the settled post() promise itself, (2) its .catch() handler, (3) its
			// .finally() handler — which is where inFlight flips and a queued follow-up re-fires.
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		},
		pending: () => settlers.length,
	};
}

describe('createReadMarker', () => {
	it('posts once when the page opens', () => {
		const { post, calls } = deferredPost();
		createReadMarker(post).open(CONV);
		expect(calls).toEqual([CONV]);
	});

	it('does nothing when the viewer is already read', () => {
		const { post } = deferredPost();
		createReadMarker(post).observe(true, CONV);
		expect(post).not.toHaveBeenCalled();
	});

	it('never runs two requests in parallel', async () => {
		const { post, settle } = deferredPost();
		const marker = createReadMarker(post);

		marker.open(CONV);
		marker.observe(false, CONV);
		expect(post).toHaveBeenCalledTimes(1); // the second one is queued, not sent

		await settle();
		expect(post).toHaveBeenCalledTimes(2);
		await settle();
	});

	it('collapses a burst of unread signals into a single follow-up', async () => {
		const { post, settle } = deferredPost();
		const marker = createReadMarker(post);

		marker.open(CONV);
		for (let i = 0; i < 5; i++) marker.observe(false, CONV);
		expect(post).toHaveBeenCalledTimes(1);

		await settle();
		expect(post).toHaveBeenCalledTimes(2); // one follow-up for all five, not five

		await settle();
		expect(post).toHaveBeenCalledTimes(2); // and nothing left over
	});

	it('re-marks an unread flip that arrives while idle', async () => {
		const { post, calls, settle } = deferredPost();
		const marker = createReadMarker(post);

		marker.open(CONV);
		await settle();
		marker.observe(false, CONV);

		expect(calls).toEqual([CONV, CONV]);
		await settle();
	});

	it('follows up with the newest conversation id when the thread switched mid-flight', async () => {
		const { post, calls, settle } = deferredPost();
		const marker = createReadMarker(post);

		marker.open('convA');
		marker.open('convB');
		expect(calls).toEqual(['convA']);

		await settle();
		expect(calls).toEqual(['convA', 'convB']);
		await settle();
	});

	it('runs the queued follow-up even when the in-flight request failed', async () => {
		const { post, settle } = deferredPost();
		const marker = createReadMarker(post);

		marker.open(CONV);
		marker.observe(false, CONV);
		await settle('reject');

		expect(post).toHaveBeenCalledTimes(2);
		await settle();
	});

	it('keeps accepting signals after a failed request', async () => {
		const { post, settle } = deferredPost();
		const marker = createReadMarker(post);

		marker.open(CONV);
		await settle('reject');
		marker.observe(false, CONV);

		expect(post).toHaveBeenCalledTimes(2);
		await settle();
	});
});
