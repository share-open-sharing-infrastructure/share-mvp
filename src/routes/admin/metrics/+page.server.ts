import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isAdmin, getLiveCoreMetrics, getMetricsHistory } from '$lib/server/metrics';

const HISTORY_DAYS = 30;

export const load: PageServerLoad = async ({ locals }) => {
	// 404 (not 403) so the route's existence isn't advertised to non-admins.
	if (!isAdmin(locals.user)) error(404);

	const [live, history] = await Promise.all([getLiveCoreMetrics(), getMetricsHistory(HISTORY_DAYS)]);

	return { live, history };
};
