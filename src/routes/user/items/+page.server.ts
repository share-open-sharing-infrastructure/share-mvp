import { fail } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { PUBLIC_PB_URL } from '../../../hooks.server';
import { texts } from '$lib/texts';
import type { Item } from '$lib/types/models';
import { getAttachableGroups } from '$lib/server/groups';
import { deleteItem, deleteMultipleItems, setItemStatus } from '$lib/server/items';
import {
	extractItemForm,
	sanitizeCategories,
	sanitizeGroups,
	validateItemFields,
	type ItemWritePayload,
} from '$lib/server/itemForm';

export async function load({ locals, url }) {
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const perPage = 25;
	const search = url.searchParams.get('search') ?? '';
	const statusFilter = url.searchParams.get('status') ?? 'all';

	const filters: string[] = [locals.pb.filter('owner = {:ownerId}', { ownerId: locals.user.id })];
	if (search) filters.push(locals.pb.filter('name ~ {:search}', { search }));
	if (statusFilter === 'available') filters.push(`status = "available"`);
	else if (statusFilter === 'unavailable') filters.push(`status = "unavailable"`);

	const [user, result] = await Promise.all([
		locals.pb.collection('users').getOne(locals.user.id),
		locals.pb.collection('items').getList(page, perPage, {
			filter: filters.join(' && '),
			sort: '-updated',
		}) as Promise<{ items: Item[]; totalItems: number; totalPages: number }>,
	]);

	const attachableGroups = await getAttachableGroups(locals.pb, locals.user.id);

	return {
		user,
		items: result.items,
		attachableGroups,
		totalItems: result.totalItems,
		totalPages: result.totalPages,
		currentPage: page,
		perPage,
		search,
		statusFilter,
		PB_URL: PUBLIC_PB_URL,
	};
}

export const actions = {
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const { name, description, place, images, rawCategories, rawGroups, trusteesOnly } =
			extractItemForm(formData);
		const validation = validateItemFields({ name, description, images }, { requireImage: true });

		if (!validation.isValid) {
			return fail(400, {
				fail: true,
				missingFields: validation.errors,
				message: texts.pages.items.validationFailed,
			});
		}

		// Trustees and groups are independent audiences — save groups regardless.
		const createGroups = await sanitizeGroups(locals.pb, locals.user.id, rawGroups);

		const payload: ItemWritePayload = {
			name,
			description,
			place,
			image: images,
			owner: locals.user.id,
			trusteesOnly,
			groups: createGroups,
			status: 'available',
			categories: sanitizeCategories(rawCategories),
		};

		try {
			await locals.pb.collection('items').create(payload);
		} catch (error) {
			// Surface the failure instead of swallowing it — otherwise the modal treats a
			// rejected create (e.g. too many images / size limit) as success and closes.
			console.error(error instanceof Error ? error.message : error);
			return fail(500, { fail: true, message: texts.pages.items.saveFailed });
		}
	},

	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const { name, description, place, images, rawCategories, rawGroups, trusteesOnly } =
			extractItemForm(formData);
		const validation = validateItemFields({ name, description, images }, { requireImage: false });

		if (!validation.isValid) {
			return fail(400, {
				fail: true,
				missingFields: validation.errors,
				message: texts.pages.items.validationFailed,
			});
		}

		// Trustees and groups are independent audiences — save groups regardless.
		const updateGroups = await sanitizeGroups(locals.pb, locals.user.id, rawGroups);

		const payload: ItemWritePayload = {
			name,
			description,
			place,
			trusteesOnly,
			groups: updateGroups,
			status: formData.get('isAvailable') === 'on' ? 'available' : 'unavailable',
			categories: sanitizeCategories(rawCategories),
		};

		// Only touch the image field when new files were uploaded; a submit without
		// new files keeps the existing images. New files replace the whole set.
		if (images.length > 0) {
			payload.image = images;
		}

		const itemId = formData?.get('itemId')?.toString();
		if (itemId) {
			try {
				await locals.pb.collection('items').update(itemId, payload);
			} catch (err) {
				// Surface the failure instead of swallowing it (see create above).
				console.error(err instanceof Error ? err.message : err);
				return fail(500, { fail: true, message: texts.pages.items.saveFailed });
			}
		}
	},

	delete: async ({ locals, request }) => {
		const itemId = (await request.formData()).get('itemId')?.toString();
		if (itemId) {
			try {
				const result = await deleteItem(locals.pb, itemId, locals.user.id);
				if (result.status === 'has_open_conversations') {
					return fail(409, {
						fail: true,
						message: texts.pages.items.deleteBlockedByConversation,
						conversationIds: result.conversationIds,
					});
				}
			} catch (err: unknown) {
				console.error(err instanceof Error ? err.message : err);
			}
		}
	},

	bulkSetStatus: async ({ locals, request }) => {
		const formData = await request.formData();
		const itemIds = formData.getAll('itemId').map(String);
		const newStatus = formData.get('newStatus')?.toString();

		if (!itemIds.length || (newStatus !== 'available' && newStatus !== 'unavailable')) {
			return fail(400, { fail: true, message: 'Ungültige Anfrage.' });
		}

		for (const itemId of itemIds) {
			try {
				await setItemStatus(locals.pb, itemId, locals.user.id, newStatus);
			} catch (err: unknown) {
				console.error(err instanceof Error ? err.message : err);
			}
		}
	},

	bulkDelete: async ({ locals, request }) => {
		const itemIds = (await request.formData()).getAll('itemId').map(String);
		if (!itemIds.length) return fail(400, { fail: true, message: 'Ungültige Anfrage.' });
		const { deleted, blocked } = await deleteMultipleItems(locals.pb, itemIds, locals.user.id);
		if (blocked.length > 0) {
			return fail(409, {
				fail: true,
				bulkBlocked: true,
				message: texts.pages.items.bulkDeletePartialBlock(deleted, blocked.length),
				conversationIds: blocked.flatMap((b) => b.conversationIds),
			});
		}
	},

	toggleTrusteesOnly: async ({ locals, request }) => {
		const formData = await request.formData();
		const itemId = formData.get('itemId')?.toString();
		if (!itemId) return fail(400, { fail: true, message: texts.errors.missingId });

		let item: Item;
		try {
			item = await locals.pb.collection('items').getOne<Item>(itemId);
		} catch {
			return fail(404, { fail: true, message: texts.errors.itemNotFound });
		}

		if (item.owner !== locals.user.id) return fail(403, { fail: true, message: texts.errors.noPermission });

		try {
			// Trustees and groups are independent — only flip the trustees flag here.
			await locals.pb.collection('items').update(itemId, { trusteesOnly: !item.trusteesOnly });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
	},

	toggleStatus: async ({ locals, request }) => {
		const formData = await request.formData();
		const itemId = formData.get('itemId')?.toString();
		if (!itemId) return fail(400, { fail: true, message: texts.errors.missingId });

		let item: Item;
		try {
			item = await locals.pb.collection('items').getOne<Item>(itemId);
		} catch {
			return fail(404, { fail: true, message: texts.errors.itemNotFound });
		}

		if (item.owner !== locals.user.id) return fail(403, { fail: true, message: texts.errors.noPermission });

		const newStatus = item.status === 'available' ? 'unavailable' : 'available';
		try {
			await setItemStatus(locals.pb, itemId, locals.user.id, newStatus);
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			return fail(e.status ?? 500, { fail: true, message: texts.errors.somethingWentWrong });
		}
	},
};
