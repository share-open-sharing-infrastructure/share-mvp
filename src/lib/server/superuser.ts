import PocketBase from 'pocketbase';
import { pbUrl } from '$lib/publicEnv';
import { env } from '$env/dynamic/private';

let cachedSuperuserClient: PocketBase | null = null;

/**
 * Returns a cached, authenticated PocketBase superuser client.
 * Re-authenticates automatically if the cached session has expired.
 *
 * Lived in `integrations/core/pocketbase.ts` until #487 Phase 3 tore the frontend integration
 * layer down; it is a general-purpose helper, not integration-specific, and `$lib/server/metrics.ts`
 * still needs it to read the superuser-only `metrics_daily` collection.
 *
 * Server-only: it reads `PB_SUPERUSER_*` from `$env/dynamic/private` (at call time, since #627).
 * Never import it from a `.svelte` component or any module reachable by the client bundle.
 *
 * This is a **per-request runtime dependency**, not just tooling: the root `+layout.server.ts`
 * calls `isAdmin()` (via `$lib/server/metrics.ts`) on every authenticated request, so without
 * the two vars the `/admin` gate closes and the public stats disappear. Both are therefore in
 * `REQUIRED_PRIVATE_ENV` (`$lib/server/env.ts`) and validated at server start.
 *
 * @returns An authenticated `PocketBase` instance valid for superuser operations.
 */
export async function getSuperuserClient(): Promise<PocketBase> {
	if (cachedSuperuserClient?.authStore.isValid) {
		return cachedSuperuserClient;
	}

	const email = env.PB_SUPERUSER_EMAIL;
	const password = env.PB_SUPERUSER_PASSWORD;
	// Same shape as scripts/seed/lib.js. Every caller already treats a rejection as "no
	// superuser access" (metrics.ts logs and degrades), so rejecting is the honest signal.
	if (!email || !password) {
		throw new Error(
			'PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD must be set to use the PocketBase superuser client.'
		);
	}

	const newSuperuserClient = new PocketBase(pbUrl());
	await newSuperuserClient.collection('_superusers').authWithPassword(email, password);
	cachedSuperuserClient = newSuperuserClient;
	return newSuperuserClient;
}
