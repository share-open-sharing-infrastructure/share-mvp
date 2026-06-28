import { error } from '@sveltejs/kit';
import { getActiveLegalDoc } from '$lib/server/legalDocs';

export async function load({ locals }) {
	const doc = await getActiveLegalDoc(locals.pb, 'privacy');
	if (!doc) throw error(404, 'Dokument derzeit nicht verfügbar.');
	return { doc };
}
