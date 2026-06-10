import { fail, redirect } from '@sveltejs/kit';
import type { Notification } from '$lib/types/models.js';

export async function load({ locals }) {
	if (!locals.user) {
		redirect(303, '/auth/login');
	}

	let notifications: Notification[] = [];
	try {
		const records = await locals.pb.collection('notifications').getFullList({
			filter: locals.pb.filter('recipient={:userId}', { userId: locals.user.id }),
			sort: '-created',
		});
		notifications = records as unknown as Notification[];
	} catch (err) {
		console.error('Failed to load notifications:', err);
	}

	return { notifications };
}

export const actions = {
	// One-way mark-as-read, called fire-and-forget from the notification link's onclick.
	// Uses a filter to guard ownership server-side, so no separate fetch is needed.
	markRead: async ({ locals, request }) => {
		const formData = await request.formData();
		const id = formData.get('id')?.toString();
		if (!id) return;
		try {
			await locals.pb.collection('notifications').update(id, { read: true }, {
				filter: locals.pb.filter('recipient={:userId} && read=false', { userId: locals.user.id }),
			});
		} catch {
			// Notification already read or not found — both are acceptable for fire-and-forget.
		}
	},

	// Bidirectional toggle used by the dot button on each row.
	toggleRead: async ({ locals, request }) => {
		const formData = await request.formData();
		const id = formData.get('id')?.toString();
		if (!id) return fail(400, { fail: true });

		let notification: Notification;
		try {
			notification = await locals.pb.collection('notifications').getOne<Notification>(id);
		} catch {
			return fail(404, { fail: true });
		}

		if (notification.recipient !== locals.user.id) return fail(403, { fail: true });

		try {
			await locals.pb.collection('notifications').update(id, { read: !notification.read });
		} catch {
			return fail(500, { fail: true });
		}
	},
};
