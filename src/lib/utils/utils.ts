import { texts } from '$lib/texts';

/**
 * The anonymized username a deleted account gets on the backend (`deleted-<15-char id>`).
 * Keep in sync with anonymizeAccount() in allerleih-backend/pb_hooks/services/account.js.
 */
const DELETED_USERNAME_RE = /^deleted-[a-z0-9]{15}$/;

/**
 * Display name for a user, masking deleted/anonymized accounts to "Gelöschtes Konto".
 * Never render `user.username` directly — always pass the user object through this helper.
 *
 * Masks when the `deleted` flag is set, OR when the username matches the backend's
 * placeholder shape. The latter is a safety net for records loaded from a source that
 * doesn't expose `deleted` (e.g. a view that omits the column), so the raw `deleted-<id>`
 * placeholder can never leak to the UI even if the flag is missing.
 */
export function displayName(
	user: { username?: string; deleted?: boolean } | null | undefined
): string {
	if (!user || user.deleted || (user.username && DELETED_USERNAME_RE.test(user.username))) {
		return texts.account.deletedAccountName;
	}
	return user.username ?? texts.account.deletedAccountName;
}

export function formatTimestamp(
	timestamp: string,
	includeYear: boolean = false
): string {
	const d = new Date(timestamp);
	const day = d.getDate();
	const month = d.getMonth() + 1; // months are 0-based
	const year = d.getFullYear();
	const hours = d.getHours();
	const minutes = d.getMinutes();

	// pad single digits (e.g. 3 → 03)
	const pad = (n: number): string => String(n).padStart(2, '0');

	// if today, return only time
	const today = new Date();
	if (d.toDateString() === today.toDateString()) {
		return `${pad(hours)}:${pad(minutes)}`;
	}

	const returnString: string = includeYear
		? `${pad(day)}.${pad(month)}.${pad(year)}`
		: `${pad(day)}.${pad(month)}. ${pad(hours)}:${pad(minutes)}`;

	return returnString;
}

import PocketBase from 'pocketbase';
import type { RecordSubscription } from 'pocketbase';

/**
 * Sets up a PocketBase real-time subscription for the respective collection and record, and unsubscribes on cleanup.
 * @param pocketBaseInstance A PocketBase instance to subscribe to
 * @param collectionName The collection name to subscribe to
 * @param recordId The record ID to subscribe to, defaults to '*' (all records in the collection)
 * @param eventHandler A callback function to handle incoming subscription events
 * TODO: Check if this needs to be done client-side, maybe it's better to do server-side? Would that work?
 */
export function setupPocketBaseSubscription(
	pocketBaseInstance: PocketBase,
	collectionName: string,
	recordId: string = '*',
	eventHandler: (event: RecordSubscription<unknown>) => void
) {
	// Subscribe to some collection's and record's events
	pocketBaseInstance
		?.collection(collectionName)
		.subscribe(recordId, eventHandler)
		.catch((error) => {
			console.error(`Failed to subscribe to ${collectionName}:`, error);
		});

	// Cleanup: unsubscribe when chat partner changes or component unmounts
	return (): void => {
		pocketBaseInstance
			?.collection(collectionName)
			.unsubscribe(recordId)
			.catch((error) => {
				console.error(`Failed to unsubscribe from ${collectionName}:`, error);
			});
	};
}
