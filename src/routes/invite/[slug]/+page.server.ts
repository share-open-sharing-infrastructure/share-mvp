export async function load({ locals, params }) {
	const { slug } = params;

	try {
		const inviter = await locals.pb.send<{ id: string; username: string }>(
			`/api/invite/${encodeURIComponent(slug)}`,
			{ method: 'GET' }
		);
		return { inviterName: inviter.username, slug };
	} catch {
		return { inviterName: null, slug };
	}
}
