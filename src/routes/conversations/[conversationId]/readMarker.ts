/**
 * Serialises the open conversation's mark-read requests (issue #412).
 *
 * Two call sites feed it and they can race:
 *
 * - `open()` — the page mounted (or switched threads). Unconditional: mark-read also clears
 *   this thread's unread notifications, which can outlive a read conversation.
 * - `observe(readByViewer)` — a realtime `conversations` update reported the viewer's read
 *   flag. `false` means an incoming message flipped us back to unread while we are looking at
 *   the thread, so read-state has to be re-asserted.
 *
 * Requests never run in parallel: anything arriving while one is in flight is coalesced into a
 * **single** follow-up once it settles. So a burst of five messages costs at most two requests,
 * not five, and re-marking still cannot be missed.
 *
 * Note that opening an unread thread legitimately costs two requests: the page's presence
 * heartbeat pings on mount and its own SSE echo returns within a few ms — before the mount's
 * mark-read has been written — so it still reports `readByViewer: false` and a follow-up is
 * queued (measured in Firefox: mount request at +0 ms taking ~15 ms, heartbeat echo at +8 ms).
 * Suppressing that stale echo instead was tried and rejected: it saves one request per open,
 * but it also swallows a *genuine* flip landing in the same window, which then waits for the
 * next heartbeat echo (up to 15 s of showing an unread thread the user is reading). The
 * redundant request is idempotent and cheap; the delay is user-visible. Robustness wins.
 *
 * @param post Issues the actual mark-read request (and any queued follow-up). Rejections are
 *   absorbed; a queued follow-up still runs.
 */
export function createReadMarker(post: (id: string) => Promise<unknown>) {
	let inFlight = false;
	/** Conversation id to re-mark once the in-flight request settles, if any. */
	let queuedId: string | undefined;

	function fire(id: string) {
		inFlight = true;
		Promise.resolve(post(id))
			.catch(() => {})
			.finally(() => {
				inFlight = false;
				const next = queuedId;
				queuedId = undefined;
				if (next !== undefined) fire(next);
			});
	}

	function request(id: string) {
		if (inFlight) {
			queuedId = id; // collapses any number of signals into one follow-up
			return;
		}
		fire(id);
	}

	return {
		/** The conversation page mounted (or switched to another thread): mark read. */
		open: request,

		/** A realtime update reported the viewer's read flag for the open conversation. */
		observe(readByViewer: boolean, id: string) {
			if (readByViewer) return; // already read — nothing to do
			request(id);
		},
	};
}
