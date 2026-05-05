<script lang="ts">
	import { Modal } from 'flowbite-svelte';
	import SparkleButton from './SparkleButton.svelte';
	import FeedbackForm from './FeedbackForm.svelte';

	let { class: className = '' } = $props<{ class?: string }>();
	let isFeedbackModalOpen = $state(false);
</script>

<SparkleButton
	label="Feedback"
	class={className}
	onclick={() => { isFeedbackModalOpen = true; }}
/>

<Modal bind:open={isFeedbackModalOpen} size="sm" title="Feedback geben">
	<FeedbackForm onsuccess={() => { isFeedbackModalOpen = false; }} />
</Modal>
