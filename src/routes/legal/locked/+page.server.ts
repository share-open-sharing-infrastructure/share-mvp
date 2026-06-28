import { redirect } from '@sveltejs/kit';
import { isLegalLocked, type LegalUser } from '$lib/server/legal';

export async function load({ locals }) {
	// Only genuinely locked accounts should see this page; everyone else is sent
	// home (the consent gate then routes them appropriately).
	if (!locals.user || !isLegalLocked(locals.user as unknown as LegalUser)) {
		redirect(303, '/');
	}
	return {};
}
