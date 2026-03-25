import { redirect } from '@sveltejs/kit';
import type { Notification } from '$lib/types/models.js';

export async function load({ locals }) {
	if (!locals.user) {
		redirect(303, '/auth/login');
	}

	let notifications: Notification[] = [];
	try {
		const records = await locals.pb.collection('notifications').getFullList({
			filter: `recipient="${locals.user.id}"`,
			sort: '-created',
		});
		notifications = records as unknown as Notification[];
	} catch (err) {
		console.error('Failed to load notifications:', err);
	}

	// Mark all unread as read
	const unread = notifications.filter((n) => !n.read);
	await Promise.all(
		unread.map((n) =>
			locals.pb.collection('notifications').update(n.id, { read: true }).catch(() => {})
		)
	);

	return { notifications };
}
