import { fail, redirect } from '@sveltejs/kit';
import { texts } from '$lib/texts';
import { getAttachableGroups } from '$lib/server/groups';
import {
	extractBulkItemDraft,
	filterAttachableGroups,
	sanitizeCategories,
	validateItemFields,
	type ItemWritePayload,
} from '$lib/server/itemForm';

export async function load({ locals }) {
	const attachableGroups = await getAttachableGroups(locals.pb, locals.user.id);
	return { attachableGroups };
}

export const actions = {
	bulkCreate: async ({ locals, request }) => {
		const formData = await request.formData();
		const itemCount = parseInt(formData.get('count') as string);
		if (!itemCount || itemCount < 1) return fail(400, { message: 'Keine Gegenstände.' });

		// Only group ids the user may actually attach (owned or member), so a
		// tampered form can't share an item with arbitrary groups. Loaded once per
		// request (not per row).
		const allowedGroupIds = new Set(
			(await getAttachableGroups(locals.pb, locals.user.id)).map((g) => g.id)
		);

		let successCount = 0;

		for (let i = 0; i < itemCount; i++) {
			const draft = extractBulkItemDraft(formData, i);
			const images = draft.image ? [draft.image] : [];

			// Skip incomplete rows (missing name/description/file) and rows whose file
			// is not an accepted image type — the shared validator applies the MIME
			// whitelist to bulk too, so an invalid image type is just another invalid row.
			if (!validateItemFields({ name: draft.name, description: draft.description, images }, { requireImage: true }).isValid) {
				continue;
			}

			const payload: ItemWritePayload = {
				name: draft.name,
				description: draft.description,
				image: draft.image ?? undefined,
				owner: locals.user.id,
				categories: sanitizeCategories(draft.rawCategories),
				groups: filterAttachableGroups(draft.rawGroups, allowedGroupIds),
				status: 'available',
				trusteesOnly: draft.trusteesOnly,
			};

			try {
				await locals.pb.collection('items').create(payload);
				successCount++;
			} catch (err: unknown) {
				console.error('bulkCreate item error:', err instanceof Error ? err.message : err);
			}
		}

		if (successCount === 0) {
			return fail(500, { message: texts.bulkUpload.uploadFailed });
		}

		redirect(303, '/user/items');
	},
};
