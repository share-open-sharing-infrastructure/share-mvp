import type { User } from '$lib/types/models.js';

export async function load({ locals }) {
	let trustees: User[] = [];
	let users: User[] = [];

	try {
		users = await locals.pb.collection('users').getFullList();
		trustees = users.filter(
			(user) => locals.user.trusts && locals.user.trusts.includes(user.id)
		);
	} catch (error: Error | any) {
		console.error(error.message ? error.message : error);
	}

	return {
		users: users,
		trustees:
			trustees.map((trustee) => ({
				...trustee,
				profilePic: `https://ui-avatars.com/api/?name=${trustee.username}&background=random`,
			})) ?? [],
	};
}

export const actions = {
	addTrustee: async ({ request, locals }): Promise<void> => {
		const formData = await request.formData();
		const newTrusteeId = formData.get('trusteeId');

		const updateData = {
			trusts: [...(locals.user.trusts || []), newTrusteeId],
		};

		try {
			await locals.pb.collection('users').update(locals.user.id, updateData);
		} catch (error: Error | any) {
			console.error(error ? error.message : error);
		}
	},
	removeTrustee: async ({ request, locals }): Promise<void> => {
		const formData = await request.formData();
		const toRemoveTrusteeId = formData.get('trusteeId');

		try {
			const updatedTrusts = (locals.user.trusts || []).filter(
				(id: string) => id !== toRemoveTrusteeId
			);
			await locals.pb
				.collection('users')
				.update(locals.user.id, { trusts: updatedTrusts });
		} catch (error: Error | any) {
			console.error(error ? error.message : error);
		}
	},
};
