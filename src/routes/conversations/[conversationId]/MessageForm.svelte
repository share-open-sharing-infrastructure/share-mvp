<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import { PaperPlaneSolid } from 'flowbite-svelte-icons';

	let {
		chatPartner,
		isSubmitting = $bindable(),
		messageText = $bindable(),
	}: {
		chatPartner: { id: string };
		isSubmitting: boolean;
		messageText: string;
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
	<!-- preventDefault on mousedown keeps focus in the input so tapping send doesn't blur
	     it and close/reopen the mobile keyboard — making a tap behave just like Enter.
	     The click still fires and submits the form. -->
	<button
		type="submit"
		disabled={isSubmitting}
		onmousedown={(e) => e.preventDefault()}
		class="flex items-center justify-center w-9 h-9 rounded-full bg-primary-400 text-white hover:bg-primary hover:cursor-pointer disabled:opacity-50 transition-colors shrink-0"
	>
		<PaperPlaneSolid class="w-4 h-4" />
	</button>
</form>
