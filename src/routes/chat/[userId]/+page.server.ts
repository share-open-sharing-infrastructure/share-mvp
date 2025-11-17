import { error } from "@sveltejs/kit";

export function load({ params }) {
	const chatTarget = params.userId;

	if (!chatTarget) {
        error(404);
    }

	return {
		chatTarget
	};
}
