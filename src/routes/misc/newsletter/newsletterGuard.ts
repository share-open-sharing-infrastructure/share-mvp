import { error } from '@sveltejs/kit';
import { instance } from '$lib/instance';

/**
 * Class D (share-mvp#631): without a configured newsletter form, neither `/misc/newsletter` nor
 * `/misc/newsletter/thanks` exists. Shared by both leaf `load`s and the `subscribe` action
 * instead of repeating `if (!instance.newsletterFormUrl) error(404);` at each of the three call
 * sites. Deliberately NOT a `+layout.server.ts`: a layout `load`'s `error()` renders
 * `+error.svelte` ABOVE the layout, dropping the page out of `src/routes/misc/+layout.svelte`'s
 * container — the guard has to be called from each leaf `load`/action instead.
 */
export function requireNewsletterFormUrl(): void {
	if (!instance.newsletterFormUrl) error(404);
}
