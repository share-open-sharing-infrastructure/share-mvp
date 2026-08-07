<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import { PaperPlaneSolid } from 'flowbite-svelte-icons';
	import Button from '$lib/components/ui/Button.svelte';
	import { onMount } from 'svelte';

	// The recipient is derived server-side from the conversation's actual participants
	// (see ?/sendMessage in +page.server.ts) — this form no longer needs (or sends) a
	// chatPartnerId, so it also no longer needs a `chatPartner` prop.
	let messageText = $state('');
	let isSubmitting = $state(false);

	let inputEl: HTMLInputElement | undefined = $state();

	// Focus the input on mount WITHOUT scrolling it into view. The HTML `autofocus`
	// attribute always scrolls the focused element into the viewport; on a mobile cold
	// load (deep link / reload) the document is taller than the visual viewport
	// (min-h-screen root shell + footer), so that scroll drags the whole page down —
	// and the conversation layout's scroll-lock then freezes it there, revealing the
	// footer and trapping the view (#529). `preventScroll` keeps focus without scrolling.
	onMount(() => {
		inputEl?.focus({ preventScroll: true });
	});
</script>

<form
	class="flex w-full items-center gap-2"
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
	<input
		bind:this={inputEl}
		name="messageContent"
		type="text"
		placeholder={texts.forms.messagePlaceholder}
		class="flex-1 rounded-full border border-tinte-200 dark:border-tinte-700 bg-papier dark:bg-tinte-800 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-300 dark:focus:ring-primary-700 transition"
		required
		autocomplete="off"
		bind:value={messageText}
	/>
	<!-- preventDefault on mousedown keeps focus in the input so tapping send doesn't blur
	     it and close/reopen the mobile keyboard — making a tap behave just like Enter.
	     The click still fires and submits the form. -->
	<Button
		type="submit"
		size="icon"
		disabled={isSubmitting}
		onmousedown={(e) => e.preventDefault()}
		aria-label={texts.ui.sendMessage}
		class="shrink-0"
	>
		<PaperPlaneSolid class="w-4 h-4" />
	</Button>
</form>
