<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';

	/**
	 * Shared confirm-and-POST modal for the two near-identical destructive confirmations
	 * on this route (delete conversation, abort request): a title + body, and a single
	 * danger-styled submit button that POSTs to `action`. Both actions read
	 * `conversationId` from `params.conversationId` (not a hidden form field), so this
	 * component never needs to know the conversation id itself.
	 */
	let {
		open = $bindable(),
		title,
		body,
		confirmLabel,
		action,
		onConfirm,
	}: {
		open: boolean;
		title: string;
		body: string;
		confirmLabel: string;
		action: string;
		/** Runs right before the form submits — e.g. closing the modal optimistically. */
		onConfirm?: () => void;
	} = $props();
</script>

<Modal {title} form bind:open>
	{body}

	<form
		class="flex justify-end gap-2 ml-2"
		method="POST"
		{action}
		use:enhance={() => {
			onConfirm?.();
			return async ({ update }) => {
				await update();
			};
		}}
	>
		<Button variant="danger" type="submit">{confirmLabel}</Button>
	</form>
</Modal>
