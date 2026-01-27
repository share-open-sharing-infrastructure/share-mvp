<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button, Input, Label } from 'flowbite-svelte';
	import { PaperPlaneSolid } from 'flowbite-svelte-icons';

	let { chatPartner, isSubmitting = $bindable(), messageText = $bindable() } = $props();
</script>

<form
	class="flex w-full items-end gap-2"
	method="POST"
	action="?/sendMessage"
	use:enhance={() => {
		isSubmitting = true;
		return async ({ update }) => {
			await update();
			isSubmitting = false;
			messageText = '';
		};
	}}
>
	<Input name="chatPartnerId" value={chatPartner.id} hidden></Input>
	<Label class="w-full ">
		<Input
			name="messageContent"
			type="text"
			placeholder="Tippe deine Nachricht..."
			class="w-full search-bar"
			required
			autocomplete="off"
			autofocus
			bind:value={messageText}
		/>
	</Label>
	<Button class="min-button" type="submit" disabled={isSubmitting}
		><PaperPlaneSolid class="shrink-0 h-full" /></Button
	>
</form>
