import { PUBLIC_PB_URL } from '../../hooks.server';
import type { Item } from '$lib/types/models';
import { filterTrustedItems } from '$lib/server/itemFilters';

export async function load({ locals, url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';

	if (!q) {
		return {
			items: [] as Item[],
			PB_IMG_URL: PUBLIC_PB_URL,
			q: '',
			currentUser: locals.user ?? null,
		};
	}

	// Escape double-quotes to prevent filter injection
	const safeQ = q.replace(/"/g, '\\"');

	const items: Item[] = await locals.pb.collection('items').getFullList({
		expand: 'owner',
		sort: '-updated',
		filter: locals.user
			? `name ~ "${safeQ}" && owner != "${locals.user.id}"`
			: `name ~ "${safeQ}"`,
	});

	const filteredItems = filterTrustedItems(
		items,
		locals.user ? locals.user.id : null,
		locals.pb.authStore.isValid
	);

	return {
		items: filteredItems,
		PB_IMG_URL: PUBLIC_PB_URL,
		q,
		currentUser: locals.user ?? null,
	};
}

export const actions = {
	saveTransportMode: async ({ locals, request }) => {
		if (!locals.user) return;
		const formData = await request.formData();
		const mode = formData.get('mode')?.toString();
		if (mode === 'foot' || mode === 'bicycle' || mode === 'car') {
			await locals.pb
				.collection('users')
				.update(locals.user.id, { preferredTransportMode: mode });
		}
	},
};
