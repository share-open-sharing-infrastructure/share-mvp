import { fail, redirect } from '@sveltejs/kit';
import { ITEM_CATEGORIES, texts, type ItemCategory } from '$lib/texts';
import { getAttachableGroups } from '$lib/server/groups';

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
		// tampered form can't share an item with arbitrary groups.
		const allowedGroupIds = new Set(
			(await getAttachableGroups(locals.pb, locals.user.id)).map((g) => g.id)
		);

		let successCount = 0;

		for (let i = 0; i < itemCount; i++) {
			const name = formData.get(`name_${i}`) as string;
			const description = formData.get(`description_${i}`) as string;
			const image = formData.get(`image_${i}`);
			const categoriesRaw = formData.get(`categories_${i}`) as string;
			const groupsRaw = formData.get(`groups_${i}`) as string;

			let categories: string[] = [];
			try {
				categories = (JSON.parse(categoriesRaw ?? '[]') as string[]).filter((c) =>
					ITEM_CATEGORIES.includes(c as ItemCategory)
				);
			} catch {
				categories = [];
			}

			let groups: string[] = [];
			try {
				groups = (JSON.parse(groupsRaw ?? '[]') as string[]).filter((id) => allowedGroupIds.has(id));
			} catch {
				groups = [];
			}

			if (!name || !description || !(image instanceof File) || image.size === 0) continue;

			try {
				await locals.pb.collection('items').create({
					name,
					description,
					image,
					owner: locals.user.id,
					categories,
					groups,
					status: 'available',
					trusteesOnly: formData.get(`trusteesOnly_${i}`) === 'on',
				});
				successCount++;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} catch (err: Error | any) {
				console.error('bulkCreate item error:', err?.message ?? err);
			}
		}

		if (successCount === 0) {
			return fail(500, { message: texts.bulkUpload.uploadFailed });
		}

		redirect(303, '/user/items');
	},
};
