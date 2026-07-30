import type PocketBase from 'pocketbase';

/** Ping cadence — see the SSE-watchdog coupling note below before changing this. */
const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Periodically updates `field` on the conversation to "now", so the backend knows the
 * current user is actively viewing it and can suppress email notifications for it while
 * they are.
 *
 * `field` MUST be exactly `ownerLastSeenAt` for the item owner or `requesterLastSeenAt`
 * for the requester — the backend's `conversations` updateRule silently rejects a PATCH
 * naming the wrong side's field, which would quietly break email suppression for that
 * user with no visible error. Get this from the caller's own role check, never guess it
 * here.
 *
 * This heartbeat also feeds an already-merged SSE watchdog: the detail page passes
 * `expectsHeartbeat: true` to `conversationRealtime.ts`'s `subscribeConversation()` for
 * exactly this reason — because each ping here echoes back over realtime as a
 * `conversations` update, a healthy stream delivers an event at least every
 * {@link HEARTBEAT_INTERVAL_MS}, letting `subscribeRealtime()`'s watchdog treat a longer
 * silence as a frozen connection and reconnect (#528). Do not change the cadence without
 * checking that coupling still holds.
 *
 * @param pb              Shared client PocketBase instance.
 * @param conversationId  Conversation to ping.
 * @param field           Which side's lastSeenAt field to update.
 * @returns A cleanup function that stops the heartbeat — call it from `$effect`'s teardown.
 */
export function startPresenceHeartbeat(
	pb: PocketBase,
	conversationId: string,
	field: 'ownerLastSeenAt' | 'requesterLastSeenAt'
): () => void {
	const ping = () => {
		// Only ping while the tab is actually visible — a backgrounded/closed tab
		// shouldn't be reported as "actively viewing" for email-suppression purposes.
		if (document.visibilityState !== 'visible') return;
		pb.collection('conversations')
			.update(conversationId, { [field]: new Date().toISOString() })
			.catch(() => {});
	};

	// Ping immediately on mount, then on the fixed cadence.
	ping();
	const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS);
	return () => clearInterval(interval);
}
