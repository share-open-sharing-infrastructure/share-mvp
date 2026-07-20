import type { PageServerLoad } from './$types';
import { getPublicStats } from '$lib/server/metrics';

export const load: PageServerLoad = async () => {
	return { stats: await getPublicStats() };
};
