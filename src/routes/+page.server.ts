import { redirect } from '@sveltejs/kit';

export async function load(): Promise<never> {
	return redirect(303, '/search');
}

export const actions = {
	feedback: async ({ locals, request }) => {
		const formData = await request.formData();

		const feedbackMessage = formData.get('feedbackMessage');
		const device = formData.get('device');
		const viewportSize = formData.get('viewportSize');
		const inputType = formData.get('inputType');
		const browser = formData.get('browser');
		const browserVersion = formData.get('browserVersion');

		const route = request.headers.get('referer');

		const feedbackData = {
			feedbackMessage,
			route,
			device,
			viewportSize,
			inputType,
			browser,
			browserVersion,
		};

		try {
			await locals.pb.collection('feedback').create(feedbackData);
			return {
				success: true,
				message: 'Feedback erfolgreich gesendet. Vielen Dank!',
			};
		} catch (error) {
			console.log('Error saving feedback:', error);
			return {
				success: false,
				message: 'Feedback konnte nicht gesendet werden.',
			};
		}
	},
};
