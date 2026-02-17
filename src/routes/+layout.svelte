<script lang="ts">
	import '../app.css';
	import { Button, Modal } from 'flowbite-svelte';
	import FeedbackForm from '$lib/components/FeedbackForm.svelte';
	import NavBarComponent from '$lib/components/NavBarComponent.svelte';
	import FooterComponent from '$lib/components/FooterComponent.svelte';

	let { children, data } = $props();

	let isFeedbackModalOpen = $state(false);
</script>

<div class="min-h-screen flex flex-col">
	<NavBarComponent loggedIn={!!data.currentUser} currentUser={data.currentUser} />

	<main class="flex-1">
		{@render children()}
	</main>

	<Button
		pill
		onclick={(): void => {
			isFeedbackModalOpen = true;
		}}
		class="
				min-button
				bg-accent-200
				fixed bottom-10 left-10 z-50
				cursor-pointer
			"
	>
		Feedback
	</Button>

	<Modal bind:open={isFeedbackModalOpen} size="sm" title="Feedback geben">
		<FeedbackForm />
	</Modal>

	<FooterComponent />
</div>
