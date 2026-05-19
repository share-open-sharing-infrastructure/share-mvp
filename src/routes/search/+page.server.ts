import { PUBLIC_PB_URL } from '../../hooks.server';
import type { Item } from '$lib/types/models';
import { ITEM_CATEGORIES, type ItemCategory } from '$lib/texts';

export async function load({ locals, url }) {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') ?? '20', 10) || 20));

	const catsParam = url.searchParams.get('cats') ?? '';
	const selectedCategories = catsParam
		.split(',')
		.map((s) => s.trim())
		.filter((s): s is ItemCategory => ITEM_CATEGORIES.includes(s as ItemCategory));
	const op: 'or' | 'and' = url.searchParams.get('op') === 'and' ? 'and' : 'or';
	const onlyAvailable = url.searchParams.get('onlyAvailable') !== 'false';
	const availabilityFilter = onlyAvailable ? "status != 'unavailable'" : null;

	const ownerTypeParam = url.searchParams.get('ownerType') ?? 'all';
	const ownerType = ownerTypeParam === 'institution' || ownerTypeParam === 'private' ? ownerTypeParam : 'all';
	const institutionFilter =
		ownerType === 'institution' ? 'owner.isInstitution = true' :
		ownerType === 'private' ? 'owner.isInstitution != true' :
		null;

	if (!q && selectedCategories.length === 0) {
		const ownerFilter = locals.user ? `owner != "${locals.user.id}"` : null;
		const trustFilter = locals.user
			? `(trusteesOnly = false || owner.trusts ~ "${locals.user.id}")`
			: `trusteesOnly = false`;
		const filter = [ownerFilter, trustFilter, availabilityFilter, institutionFilter].filter(Boolean).join(' && ') || undefined;

		const result = await locals.pb.collection('items').getList<Item>(1, 8, {
			expand: 'owner',
			sort: '@random',
			filter,
		});

		return {
			items: result.items,
			PB_IMG_URL: PUBLIC_PB_URL,
			q: '',
			selectedCategories,
			op,
			onlyAvailable,
			ownerType,
			currentUser: locals.user ?? null,
			page: 1,
			perPage,
			totalItems: result.totalItems,
			totalPages: 0,
			isRandom: true,
		};
	}

	const isAllItems = !q || q === '*';

	const buildSearchFilter = (raw: string): string | null => {
		if (!raw || raw === '*') return null;
		const tokens = raw.trim().split(/\s+/).filter(Boolean);
		if (tokens.length === 0) return null;
		return tokens
			.map((token) => {
				const safe = token.replace(/"/g, '\\"');
				return `(name ~ "${safe}" || description ~ "${safe}")`;
			})
			.join(' && ');
	};
	const nameFilter = buildSearchFilter(q);
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
	const filter = [nameFilter, ownerFilter, categoryFilter, trustFilter, availabilityFilter, institutionFilter].filter(Boolean).join(' && ') || undefined;

	const result = await locals.pb.collection('items').getList<Item>(page, perPage, {
		expand: 'owner',
		sort: '-updated',
		filter,
	});

	void locals.pb.collection('searches').create({
		query: q,
		categories: selectedCategories.join(','),
	});

	return {
		items: result.items,
		PB_IMG_URL: PUBLIC_PB_URL,
		q,
		selectedCategories,
		op,
		onlyAvailable,
		ownerType,
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
			locals.pb
				.collection('users')
				.update(locals.user.id, { preferredTransportMode: mode });
		}
	},
};
