import { fail } from '@sveltejs/kit';

export async function load() {
	return {};
}

const validImageTypes = [
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
];

export const actions = {
	batchCreate: async ({ locals, request }) => {
		const formData = await request.formData();

		const name = formData.get('itemName')?.toString();
		const description = formData.get('itemDescription')?.toString();
		const place = formData.get('itemPlace')?.toString();
		const image = formData.get('itemImage');

		const isValidImage =
			image instanceof File &&
			image.size > 0 &&
			validImageTypes.includes(image.type);

		if (!name || !description || !place || !isValidImage) {
			return fail(400, { message: 'Ungültige Daten.' });
		}

		try {
			await locals.pb.collection('items').create({
				name,
				description,
				place,
				image,
				owner: locals.user.id,
				trusteesOnly: formData.get('trusteesOnly') === 'on',
			});
		} catch (err) {
			console.error('batchCreate error:', err instanceof Error ? err.message : err);
			return fail(500, { message: 'Speichern fehlgeschlagen.' });
		}
	},
};
