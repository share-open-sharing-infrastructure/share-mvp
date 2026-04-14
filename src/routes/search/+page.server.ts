import { PUBLIC_PB_URL } from '../../hooks.server';
import type { Item } from '$lib/types/models';
import { ITEM_CATEGORIES, type ItemCategory } from '$lib/texts';

export async function load({ locals, url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') ?? '10', 10) || 10));

	const catsParam = url.searchParams.get('cats') ?? '';
	const selectedCategories = catsParam
		.split(',')
		.map((s) => s.trim())
		.filter((s): s is ItemCategory => ITEM_CATEGORIES.includes(s as ItemCategory));
	const op: 'or' | 'and' = url.searchParams.get('op') === 'and' ? 'and' : 'or';

	if (!q && selectedCategories.length === 0) {
		return {
			items: [] as Item[],
			PB_IMG_URL: PUBLIC_PB_URL,
			q: '',
			selectedCategories,
			op,
			currentUser: locals.user ?? null,
			page: 1,
			perPage,
			totalItems: 0,
			totalPages: 0,
		};
	}

	const isAllItems = !q || q === '*';

	// Escape double-quotes to prevent filter injection (only needed for name filter)
	const safeQ = q.replace(/"/g, '\\"');

	const nameFilter = isAllItems ? null : `name ~ "${safeQ}"`;
	const ownerFilter = locals.user ? `owner != "${locals.user.id}"` : null;

	// Escape & as \& so PocketBase's filter parser doesn't misinterpret it as the && operator.
	const escapeCatValue = (c: string) => c.replace(/&/g, '\\&');
	const categoryFilter =
		selectedCategories.length > 0
			? `(${selectedCategories.map((c) => `categories ~ '${escapeCatValue(c)}'`).join(op === 'and' ? ' && ' : ' || ')})`
			: null;
	const trustFilter = locals.user
		? `(trusteesOnly = false || owner.trusts ~ "${locals.user.id}")`
		: `trusteesOnly = false`;
	const filter = [nameFilter, ownerFilter, categoryFilter, trustFilter].filter(Boolean).join(' && ') || undefined;


	const result = await locals.pb.collection('items').getList<Item>(page, perPage, {
		expand: 'owner',
		sort: '-updated',
		filter,
	});

	return {
		items: result.items,
		PB_IMG_URL: PUBLIC_PB_URL,
		q,
		selectedCategories,
		op,
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
