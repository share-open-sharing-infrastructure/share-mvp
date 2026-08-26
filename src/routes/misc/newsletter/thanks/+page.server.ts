import type { PageServerLoad } from './$types';
import { requireNewsletterFormUrl } from '../newsletterGuard';

/**
 * Class D (share-mvp#631): guards this page the same way as `../+page.server.ts` — without a
 * configured newsletter form, nobody can have reached `/subscribe` to land here either.
 */
export const load: PageServerLoad = () => {
	requireNewsletterFormUrl();
};
