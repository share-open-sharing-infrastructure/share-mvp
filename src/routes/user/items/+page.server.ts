import { fail } from '@sveltejs/kit';
import { PUBLIC_PB_URL } from '../../../hooks.server';
import { ITEM_CATEGORIES, type ItemCategory } from '$lib/texts';
import type { Item } from '$lib/types/models';

export async function load({ locals, url }) {
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const perPage = 25;
	const search = url.searchParams.get('search') ?? '';
	const statusFilter = url.searchParams.get('status') ?? 'all';

	const filters: string[] = [`owner = "${locals.user.id}"`];
	if (search) filters.push(`name ~ "${search.replace(/"/g, '')}"`);
	if (statusFilter === 'available') filters.push(`status = "available"`);
	else if (statusFilter === 'unavailable') filters.push(`status = "unavailable"`);

	const [user, result] = await Promise.all([
		locals.pb.collection('users').getOne(locals.user.id),
		locals.pb.collection('items').getList(page, perPage, {
			filter: filters.join(' && '),
			sort: '-updated',
		}) as Promise<{ items: Item[]; totalItems: number; totalPages: number }>,
	]);

	return {
		user,
		items: result.items,
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

		try {
			await locals.pb.collection('items').create({
				name: formData.get('itemName'),
				description: formData.get('itemDescription'),
				place: formData.get('itemPlace'),
				image: formData.get('itemImage'),
				owner: locals.user.id,
				trusteesOnly: formData.get('trusteesOnly') === 'on' ? true : false,
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

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const updateData: Record<string, any> = {
			name: formData.get('itemName'),
			description: formData.get('itemDescription'),
			place: formData.get('itemPlace'),
			trusteesOnly: formData.get('trusteesOnly') === 'on' ? true : false,
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
				const conversations = await locals.pb
					.collection('conversations')
					.getFullList({ filter: `requestedItem = "${itemId}"` });

				for (const conversation of conversations) {
					await locals.pb.collection('conversations').delete(conversation.id);
				}

				await locals.pb.collection('items').delete(itemId);
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
				const item = await locals.pb.collection('items').getOne(itemId);
				if (item.owner !== locals.user.id) continue;
				await locals.pb.collection('items').update(itemId, { status: newStatus });
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (err: Error | any) {
				console.error(err?.message ?? err);
			}
		}
	},

	toggleStatus: async ({ locals, request }) => {
		const formData = await request.formData();
		const itemId = formData.get('itemId')?.toString();
		if (!itemId) return fail(400, { fail: true, message: 'Fehlende Item-ID.' });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let item: any;
		try {
			item = await locals.pb.collection('items').getOne(itemId);
		} catch {
			return fail(404, { fail: true, message: 'Gegenstand nicht gefunden.' });
		}

		if (item.owner !== locals.user.id) return fail(403, { fail: true, message: 'Keine Berechtigung.' });

		const newStatus = item.status === 'available' ? 'unavailable' : 'available';
		try {
			await locals.pb.collection('items').update(itemId, { status: newStatus });
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (err: Error | any) {
			console.error(err?.message ?? err);
		}
	},
};
