import { fail } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { PUBLIC_PB_URL } from '../../../hooks.server';
import { ITEM_CATEGORIES, texts, type ItemCategory } from '$lib/texts';
import type { Item } from '$lib/types/models';
import { getAttachableGroups } from '$lib/server/groups';
import { deleteItem, deleteMultipleItems, setItemStatus } from '$lib/server/items';

/**
 * Keep only the submitted group ids the user is actually allowed to attach
 * (groups they own or are a member of), so a tampered form can't share an item
 * with arbitrary groups.
 */
async function sanitizeGroups(
	pb: App.Locals['pb'],
	userId: string,
	submitted: string[]
): Promise<string[]> {
	if (submitted.length === 0) return [];
	const allowed = new Set((await getAttachableGroups(pb, userId)).map((g) => g.id));
	return submitted.filter((id) => allowed.has(id));
}

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

function validateItemData(data: FormData, isImageRequired: boolean = true) {
	const name = data.get('itemName');
	const description = data.get('itemDescription');
	const image = data.get('itemImage');

	// Check if image is a valid image file
	const validImageTypes = [
		'image/jpeg',
		'image/jpg',
		'image/png',
		'image/gif',
		'image/webp',
		'image/svg+xml',
	];
	const isValidImage =
		image instanceof File &&
		image.size > 0 &&
		validImageTypes.includes(image.type);

	const errors = {
		nameIsMissing: !name,
		descriptionIsMissing: !description,
		imageIsMissing: isImageRequired
			? !image || !(image instanceof File) || image.size === 0
			: false,
		imageInvalidType:
			image instanceof File && image.size > 0 ? !isValidImage : false,
	};

	return { isValid: Object.values(errors).every((e) => !e), errors };
}

export const actions = {
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const validationResult = validateItemData(formData, true);

		if (!validationResult.isValid) {
			return fail(400, {
				fail: true,
				missingFields: validationResult.errors,
				message:
					'Es fehlen erforderliche Felder oder es wurden ungültige Bilddateien hochgeladen.',
			});
		}

		const createCategories = (formData.getAll('categories') as string[]).filter((c) =>
			ITEM_CATEGORIES.includes(c as ItemCategory)
		);
		const trusteesOnly = formData.get('trusteesOnly') === 'on';
		// Trustees and groups are independent audiences — save groups regardless.
		const createGroups = await sanitizeGroups(
			locals.pb,
			locals.user.id,
			formData.getAll('groups') as string[]
		);

		try {
			await locals.pb.collection('items').create({
				name: formData.get('itemName'),
				description: formData.get('itemDescription'),
				place: formData.get('itemPlace'),
				image: formData.get('itemImage'),
				owner: locals.user.id,
				trusteesOnly,
				groups: createGroups,
				status: 'available',
				categories: createCategories,
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: Error | any) {
			console.error(error ? error.message : error);
		}
	},

	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const validationResult = validateItemData(formData, false);

		if (!validationResult.isValid) {
			return fail(400, {
				fail: true,
				missingFields: validationResult.errors,
				message:
					'Es fehlen erforderliche Felder oder es wurden ungültige Bilddateien hochgeladen.',
			});
		}

		const updateCategories = (formData.getAll('categories') as string[]).filter((c) =>
			ITEM_CATEGORIES.includes(c as ItemCategory)
		);
		const trusteesOnly = formData.get('trusteesOnly') === 'on';
		// Trustees and groups are independent audiences — save groups regardless.
		const updateGroups = await sanitizeGroups(
			locals.pb,
			locals.user.id,
			formData.getAll('groups') as string[]
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const updateData: Record<string, any> = {
			name: formData.get('itemName'),
			description: formData.get('itemDescription'),
			place: formData.get('itemPlace'),
			trusteesOnly,
			groups: updateGroups,
			status: formData.get('isAvailable') === 'on' ? 'available' : 'unavailable',
			categories: updateCategories,
		};

		// Check if a new image was uploaded
		const image = formData.get('itemImage');
		if (image && image instanceof File && image.size > 0) {
			updateData.image = image;
		}

		const itemId = formData?.get('itemId')?.toString();
		if (itemId) {
			try {
				await locals.pb.collection('items').update(itemId, updateData);
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (err: Error | any) {
				console.error(err ? err.message : err);
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (err: Error | any) {
				console.error(err ? err.message : err);
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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (err: Error | any) {
				console.error(err?.message ?? err);
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
