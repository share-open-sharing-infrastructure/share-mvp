import { PUBLIC_PB_URL } from '../../hooks.server';
import type { Item } from '$lib/types/models';
import { filterTrustedItems } from '$lib/server/itemFilters';

export async function load({ locals, url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') ?? '10', 10) || 10));

	if (!q) {
		return {
			items: [] as Item[],
			PB_IMG_URL: PUBLIC_PB_URL,
			q: '',
			currentUser: locals.user ?? null,
			page: 1,
			perPage,
			totalItems: 0,
			totalPages: 0,
		};
	}

	const isAllItems = q === '*';

	// Escape double-quotes to prevent filter injection (only needed for name filter)
	const safeQ = q.replace(/"/g, '\\"');

	const nameFilter = isAllItems ? null : `name ~ "${safeQ}"`;
	const ownerFilter = locals.user ? `owner != "${locals.user.id}"` : null;
	const filter = [nameFilter, ownerFilter].filter(Boolean).join(' && ') || undefined;

	const result = await locals.pb.collection('items').getList<Item>(page, perPage, {
		expand: 'owner',
		sort: '-updated',
		filter,
	});

	const filteredItems = filterTrustedItems(
		result.items,
		locals.user ? locals.user.id : null,
		locals.pb.authStore.isValid
	);

	return {
		items: filteredItems,
		PB_IMG_URL: PUBLIC_PB_URL,
		q,
		currentUser: locals.user ?? null,
		page: result.page,
		perPage: result.perPage,
		totalItems: result.totalItems,
		totalPages: result.totalPages,
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
