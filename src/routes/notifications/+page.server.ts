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

	return { notifications };
}

export const actions = {
	// One-way mark-as-read, called fire-and-forget from the notification link's onclick.
	// Early-exits if already read so repeated calls are safe.
	markRead: async ({ locals, request }) => {
		const formData = await request.formData();
		const id = formData.get('id')?.toString();
		if (!id) return;
		const notification = await locals.pb.collection('notifications').getOne(id);
		if (notification.recipient !== locals.user.id || notification.read) return;
		await locals.pb.collection('notifications').update(id, { read: true });
	},

	// Bidirectional toggle used by the dot button on each row.
	toggleRead: async ({ locals, request }) => {
		const formData = await request.formData();
		const id = formData.get('id')?.toString();
		if (!id) return;

		const notification = await locals.pb.collection('notifications').getOne(id);
		if (notification.recipient !== locals.user.id) return;

		await locals.pb.collection('notifications').update(id, { read: !notification.read });
	},
};
