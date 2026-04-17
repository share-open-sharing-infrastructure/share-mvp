<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import { PaperPlaneSolid } from 'flowbite-svelte-icons';

	let {
		chatPartner,
		isSubmitting = $bindable(),
		messageText = $bindable(),
	} = $props();
</script>

<form
	class="flex w-full items-center gap-2"
	method="POST"
	action="?/sendMessage"
	use:enhance={() => {
		isSubmitting = true;
		return async ({ update }) => {
			await update({reset: false}); // Have to disable reset, otherwise Svelte clears the form data and the target user is not found
			isSubmitting = false;
			messageText = '';
		};
	}}
>
	<input name="chatPartnerId" value={chatPartner.id} hidden />
	<!-- svelte-ignore a11y_autofocus -->
	<input
		name="messageContent"
		type="text"
		placeholder={texts.forms.messagePlaceholder}
		class="flex-1 rounded-full border border-tinte-200 dark:border-tinte-700 bg-papier dark:bg-tinte-800 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300 dark:focus:ring-primary-700 transition"
		required
		autocomplete="off"
		autofocus={true}
		bind:value={messageText}
	/>
	<button
		type="submit"
		disabled={isSubmitting}
		class="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-white hover:bg-primary-600 disabled:opacity-50 transition-colors shrink-0"
	>
		<PaperPlaneSolid class="w-4 h-4" />
	</button>
</form>
