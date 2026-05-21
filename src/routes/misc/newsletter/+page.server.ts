import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	subscribe: async ({ request }) => {
		const data = await request.formData();

		fetch('https://app.keila.io/forms/nfrm_b94Bj5RD', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				'contact[email]': (data.get('contact[email]') as string) ?? '',
				'contact[first_name]': (data.get('contact[first_name]') as string) ?? '',
				'h[url]': '',
			}),
		}).catch(() => {});

		redirect(303, '/misc/newsletter/thanks');
	},
};
