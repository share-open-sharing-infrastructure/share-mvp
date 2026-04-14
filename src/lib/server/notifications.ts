import webpush from 'web-push';
import { VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '$env/static/private';
import { PUBLIC_VAPID_PUBLIC_KEY } from '$env/static/public';
import type { NotificationType } from '$lib/types/models.js';
import type PocketBase from 'pocketbase';

webpush.setVapidDetails(VAPID_SUBJECT, PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

/** Minimum gap between new_message notifications for the same conversation (ms). */
export const MESSAGE_NOTIFICATION_COOLDOWN_MS = 60_000; // 1 minute — adjust to taste

/**
 * Returns true if a new_message notification for this recipient+conversation
 * was already sent within the cooldown window and a new one should be suppressed.
 */
export async function isMessageNotificationThrottled(
	pb: PocketBase,
	recipientId: string,
	conversationId: string
): Promise<boolean> {
	try {
		const recent = await pb.collection('notifications').getList(1, 1, {
			filter: `recipient="${recipientId}" && relatedId="${conversationId}" && type="new_message"`,
			sort: '-created',
		});
		if (recent.items.length === 0) return false;
		const lastCreated = new Date(recent.items[0].created).getTime();
		return Date.now() - lastCreated < MESSAGE_NOTIFICATION_COOLDOWN_MS;
	} catch (err) {
		console.error('Failed to check notification throttle:', err);
		return false; // fail open — send the notification if the check itself fails
	}
}

/**
 * Creates a notification record in PocketBase for the given recipient.
 */
export async function createNotification(
	pb: PocketBase,
	recipientId: string,
	senderId: string | undefined,
	type: NotificationType,
	relatedId: string,
	body: string
): Promise<void> {
	try {
		await pb.collection('notifications').create({
			recipient: recipientId,
			sender: senderId,
			type,
			relatedId,
			body,
			read: false,
		});
	} catch (err) {
		console.error('Failed to create notification:', err);
	}
}

/**
 * Sends a push notification to all registered devices of a user.
 * Stale subscriptions (HTTP 410 Gone) are automatically removed.
 */
export async function sendPushToUser(
	pb: PocketBase,
	userId: string,
	title: string,
	body: string,
	url: string
): Promise<void> {
	let subscriptions;
	try {
		subscriptions = await pb
			.collection('push_subscriptions')
			.getFullList({ filter: `user="${userId}"` });
	} catch (err) {
		console.error('Failed to fetch push subscriptions:', err);
		return;
	}

	const payload = JSON.stringify({ title, body, url });

	await Promise.all(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth },
					},
					payload
				);
			} catch (err: unknown) {
				const status = (err as { statusCode?: number }).statusCode;
				if (status === 410 || status === 404) {
					// Subscription is no longer valid — remove it
					try {
						await pb.collection('push_subscriptions').delete(sub.id);
					} catch {
						// ignore cleanup errors
					}
				} else {
					console.error('Failed to send push notification:', err);
				}
			}
		})
	);
}
