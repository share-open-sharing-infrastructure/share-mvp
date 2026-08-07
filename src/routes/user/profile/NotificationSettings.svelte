<script lang="ts">
	import { texts } from '$lib/texts';
	import PushNotificationSection from './PushNotificationSection.svelte';
	import EmailNotificationForm from './EmailNotificationForm.svelte';
	import type { UserPreferences } from '$lib/types/models';

	let { prefs }: { prefs: UserPreferences | null } = $props();

	// #607 review split: this component used to hold both the push-subscription state machine
	// and the SSR-seeded email/digest form; it's now a thin wrapper around the two (card +
	// heading only) so each can be read/reviewed on its own. `pushSupported` is lifted here
	// because EmailNotificationForm's top divider needs to know whether the (otherwise
	// unrelated) push section rendered above it — see PushNotificationSection's `$bindable`.
	let pushSupported = $state(false);
</script>

<div
	class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8"
>
	<h2 class="text-lg font-semibold text-tinte-900 dark:text-white mb-4">
		{texts.pages.profile.notifications.sectionTitle}
	</h2>
	<PushNotificationSection bind:pushSupported />
	<EmailNotificationForm {prefs} {pushSupported} />
</div>
