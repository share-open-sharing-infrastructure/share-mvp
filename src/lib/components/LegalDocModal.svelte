<script lang="ts">
	import { Modal } from 'flowbite-svelte';

	// Renders a legal document (ToS / privacy) inline in a modal instead of opening a
	// new tab — a new tab is unusable in the installed PWA (it kicks out to an external
	// browser), and in-app navigation would lose the consent form's state. The body is
	// the operator-managed HTML from the legal_documents collection (trusted, no user input).
	let {
		open = $bindable(false),
		title,
		version,
		effectiveDate,
		body
	}: {
		open?: boolean;
		title: string;
		version: string;
		effectiveDate: string;
		body: string;
	} = $props();
</script>

<Modal {title} bind:open size="xl" outsideclose>
	<p class="-mt-2 mb-4 text-sm text-gray-500">Stand: {effectiveDate} · Version {version}</p>
	<div class="legal-prose max-w-none">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html body}
	</div>
</Modal>
