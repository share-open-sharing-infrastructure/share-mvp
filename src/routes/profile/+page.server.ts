import { fail } from '@sveltejs/kit';
import { PUBLIC_PB_URL } from '../../hooks.server';

export async function load({ locals }) {
	const user = await locals.pb.collection('users').getOne(
		locals.user.id,
		{ expand: 'items_via_owner' } // expands the user "backwards" from the items collection, i.e. pulls all items related to this user
	);

	return {
		user: user,
		PB_URL: PUBLIC_PB_URL
	};
}

function validateItemData(data: FormData, isImageRequired: boolean = true) {
	const name = data.get('itemName');
	const description = data.get('itemDescription');
	const place = data.get('itemPlace');
	const image = data.get('itemImage');

	// Check if image is a valid image file
	const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
	const isValidImage = image instanceof File && image.size > 0 && validImageTypes.includes(image.type);

	const errors = {
		nameIsMissing: !name,
		descriptionIsMissing: !description,
		placeIsMissing: !place,
		imageIsMissing: isImageRequired ? (!image || !(image instanceof File) || image.size === 0) : false,
		imageInvalidType: image instanceof File && image.size > 0 ? !isValidImage : false
	};

	return { isValid: Object.values(errors).every(e => !e), errors };
}

export const actions = {
	create: async ({ locals, request }) => {
		const formData = await request.formData();
		const validationResult = validateItemData(formData, true);

		if (!validationResult.isValid) {
			return fail(400, {
				fail: true,
				missingFields: validationResult.errors,
				message: 'Es fehlen erforderliche Felder oder es wurden ungültige Bilddateien hochgeladen.'
			});
		}

		try {
			await locals.pb.collection('items').create({
				name: formData.get('itemName'),
				description: formData.get('itemDescription'),
				place: formData.get('itemPlace'),
				image: formData.get('itemImage'),
				owner: locals.user.id,
				trusteesOnly: formData.get('trusteesOnly') === 'on' ? true : false
			});
		} catch (error) {
			console.error(error?.message || error);
		}
	},

	update: async ({ locals, request }) => {
		const formData = await request.formData();
		const validationResult = validateItemData(formData, false);

		if (!validationResult.isValid) {
			return fail(400, {
				fail: true,
				missingFields: validationResult.errors,
				message: 'Es fehlen erforderliche Felder oder es wurden ungültige Bilddateien hochgeladen.'
			});
		}

		const updateData: Record<string, any> = {
			name: formData.get('itemName'),
			description: formData.get('itemDescription'),
			place: formData.get('itemPlace'),
			trusteesOnly: formData.get('trusteesOnly') === 'on' ? true : false
		};

		// Check if a new image was uploaded
		const image = formData.get('itemImage');
		if (image && image instanceof File && image.size > 0) {
			updateData.image = image;
		}

		const itemId = formData.get('itemId').toString();
		try {
			await locals.pb
				.collection('items')
				.update(itemId, updateData);
		} catch (err) {
			console.error(err?.message || err);
		}
	},

	delete: async ({ locals, request }) => {
		const itemId = (await request.formData()).get('itemId').toString();
		try {
			await locals.pb
				.collection('items')
				.delete(itemId);
		} catch (error) {
			console.error(error?.message || error);
		}
	}
};
