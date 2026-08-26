import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { normalizeEmail } from '$lib/server/email';
import { instance } from '$lib/instance';
import { requireNewsletterFormUrl } from './newsletterGuard';

export const load: PageServerLoad = () => {
	requireNewsletterFormUrl();
};

export const actions: Actions = {
	subscribe: async ({ request }) => {
		// Form actions run BEFORE load functions — the load guard above does NOT protect this
		// action; it needs its own guard, checked before anything else (including reading the
		// form body), so a handcrafted POST can never reach the third-party fetch below either.
		requireNewsletterFormUrl();

		const data = await request.formData();

		// Awaited + caught (not fire-and-forget): until this change `subscribe` was dead code (the
		// page did a native cross-origin POST straight to Keila), so a swallowed failure here was
		// latent. It's the live path now — same await/catch/no-rethrow shape as
		// `signUpForNewsletter()` in `$lib/server/registration.ts`, so a failed newsletter signup
		// logs but never 500s the user. `redirect()` throws, so it MUST stay outside this
		// try/catch — inside it, the catch would swallow the redirect and the action would
		// silently return nothing.
		try {
			await fetch(instance.newsletterFormUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					'contact[email]': normalizeEmail((data.get('contact[email]') as string) ?? ''),
					'contact[first_name]': (data.get('contact[first_name]') as string) ?? '',
					'h[url]': '',
				}),
			});
		} catch (err) {
			console.error('Newsletter signup failed:', err);
		}

		redirect(303, '/misc/newsletter/thanks');
	},
};
