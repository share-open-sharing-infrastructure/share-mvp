import { fail } from '@sveltejs/kit';
import { PUBLIC_PB_URL } from '../../hooks.server';


export async function load({ locals, url, fetch }) {
	const user = await locals.pb.collection('users').getOne(
		locals.user.id,
		{ expand: 'items_via_owner' }
	);

	return {
		user,
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

	saveProfile: async ({ locals, request }) => {
		const formData = await request.formData();

		const updateData = {};

		// Get username separately to check for spaces
		const username = formData.get('username').toString();
		if (username) {
			const trimmedUsername = username.trim();
			if (trimmedUsername.includes(' ')) {
				return {
					error: true,
					message: 'Nutzername darf keine Leerzeichen enthalten.'
				};
			} else if (trimmedUsername !== '') {
				updateData['username'] = trimmedUsername;
			}
		}

		// Handle other fields
		const city = formData.get('city').toString();
		if (city && city.trim() !== '') {
			updateData['city'] = city.trim();
		}

		try {
			if (Object.keys(updateData).length > 0) {
				await locals.pb.collection('users').update(locals.user.id, updateData);
				return {
					success: true,
					message: 'Daten wurden erfolgreich aktualisiert.'
				};
			} else {
				return {
					error: true,
					message: 'Daten konnten nicht aktualisiert werden. Bitte überprüfen Sie Ihre Eingaben.'
				};
			}
		} catch (err) {
			return {
				error: true,
				message: 'Daten konnten nicht aktualisiert werden. Bitte überprüfen Sie Ihre Eingaben.'
			};
		}
	},


	delete: async ({ locals, request }) => {
		const itemId = (await request.formData()).get('itemId').toString();
		try {
			await locals.pb
				.collection('items')
				.delete(itemId);
		} catch (err) {
			console.error(err?.message || err);
		}
	}
};
