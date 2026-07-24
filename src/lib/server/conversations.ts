import type PocketBase from 'pocketbase';

/**
 * Re-exported for the two server `load()`s in this route (`+layout.server.ts`,
 * `[conversationId]/+page.server.ts`) that historically imported it from here. The
 * implementation now lives in `$lib/conversationPartnerFields.ts` (outside `$lib/server`) so
 * that `conversationListRealtime.ts` — which runs client-side — can use it too, since
 * SvelteKit forbids importing `$lib/server/*` from client code.
 */
export { conversationFieldsWithSafePartners } from '$lib/conversationPartnerFields';

/**
 * Deletes a conversation and every notification referencing it.
 *
 * Lives here (rather than in the `[conversationId]` route) because `$lib/server/items.ts`
 * needs it too when cascading item deletion to its conversations — libs must never import
 * from routes, so this is the shared home both the route action and `items.ts` call into.
 *
 * Throws on failure — caller is responsible for catching and returning fail().
 */
export async function deleteConversation(pb: PocketBase, conversationId: string): Promise<void> {
	await pb.collection('conversations').delete(conversationId);

	try {
		const orphaned = await pb.collection('notifications').getFullList({
			filter: pb.filter('relatedId={:conversationId}', { conversationId }),
		});
		await Promise.all(orphaned.map((n) => pb.collection('notifications').delete(n.id)));
	} catch (err) {
		console.error('Failed to clean up orphaned notifications for conversation', err);
	}
}
