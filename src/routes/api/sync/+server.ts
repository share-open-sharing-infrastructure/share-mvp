import type { RequestHandler } from './$types';
import { makeSyncHandler } from '$lib/server/integrations/syncEndpoint';
import { runAllIntegrations } from '$lib/server/integrations/registry';

/** Triggers a full sync for all configured pull integrations. Driven by a cron job. */
export const POST: RequestHandler = makeSyncHandler('sync', runAllIntegrations);
