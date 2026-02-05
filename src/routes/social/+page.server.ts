export async function load({ locals }) {
	let trustees;
	let users;

	try {
		users = await locals.pb.collection('users').getFullList();
		trustees = users.filter(
			(user) => locals.user.trusts && locals.user.trusts.includes(user.id)
		);
	} catch (error) {
		console.error(error?.message || error);
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
	addTrustee: async ({ request, locals }) => {
		const formData = await request.formData();
		const newTrusteeId = formData.get('trusteeId');

		const updateData = {
			trusts: [...(locals.user.trusts || []), newTrusteeId],
		};

		try {
			const record = await locals.pb
				.collection('users')
				.update(locals.user.id, updateData);
		} catch (err) {
			console.error(err?.message || err);
		}
	},
	removeTrustee: async ({ request, locals }) => {
		const formData = await request.formData();
		const toRemoveTrusteeId = formData.get('trusteeId');

		try {
			const updatedTrusts = (locals.user.trusts || []).filter(
				(id) => id !== toRemoveTrusteeId
			);
			const record = await locals.pb
				.collection('users')
				.update(locals.user.id, { trusts: updatedTrusts });
		} catch (err) {
			console.error(err?.message || err);
		}
	},
};
