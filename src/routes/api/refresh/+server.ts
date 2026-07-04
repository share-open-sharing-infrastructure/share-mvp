import type { RequestHandler } from './$types';
import { makeSyncHandler } from '$lib/server/integrations/syncEndpoint';
import { refreshAllIntegrations } from '$lib/server/integrations/registry';

/**
 * Refreshes already-stored external items per item (update changed, archive gone; never create).
 * Lighter than a full `/api/sync`; driven by a cron job for sources without an easy bulk re-pull.
 * Pass `?institution=<id>` to refresh a single institution; omit it to refresh all.
 */
export const POST: RequestHandler = makeSyncHandler('refresh', (pb, url) =>
	refreshAllIntegrations(pb, url.searchParams.get('institution') ?? undefined)
);
