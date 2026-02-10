<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts.js';
	let { data } = $props();
</script>

{#if data.chatPartners.length === 0}
	<div class="flex h-full flex-col items-center justify-center">
		<span class="text-gray-500">Du hast noch keine Chats.</span>
		<span class="text-gray-500"
			>Starte ein Gespräch, indem du jemanden anschreibst!</span
		>
		<span class="text-gray-500"
			>Gehe dazu auf die <a
				href={resolve('/search')}
				class="text-secondary-600 underline">{texts.nav.search}</a
			> und finde einen Gegenstand.</span
		>
	</div>
{:else}
	<div class="flex h-full flex-col items-center justify-center">
		<span class="text-gray-500">{texts.ui.chooseFromList}</span>
	</div>
{/if}
