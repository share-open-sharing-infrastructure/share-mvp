import PocketBase from 'pocketbase';
import { PUBLIC_PB_URL } from '$env/static/public';
import { PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD } from '$env/static/private';

let cachedSuperuserClient: PocketBase | null = null;

/**
 * Returns a cached, authenticated PocketBase superuser client.
 * Re-authenticates automatically if the cached session has expired.
 *
 * Lived in `integrations/core/pocketbase.ts` until #487 Phase 3 tore the frontend integration
 * layer down; it is a general-purpose helper, not integration-specific, and `$lib/server/metrics.ts`
 * still needs it to read the superuser-only `metrics_daily` collection.
 *
 * Server-only: it reads `PB_SUPERUSER_*` from `$env/static/private`. Never import it from a
 * `.svelte` component or any module reachable by the client bundle.
 *
 * @returns An authenticated `PocketBase` instance valid for superuser operations.
 */
export async function getSuperuserClient(): Promise<PocketBase> {
	if (cachedSuperuserClient?.authStore.isValid) {
		return cachedSuperuserClient;
	}

	const newSuperuserClient = new PocketBase(PUBLIC_PB_URL);
	await newSuperuserClient
		.collection('_superusers')
		.authWithPassword(PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD);
	cachedSuperuserClient = newSuperuserClient;
	return newSuperuserClient;
}
