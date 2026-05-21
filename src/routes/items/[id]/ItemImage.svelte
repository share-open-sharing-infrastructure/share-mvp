<script lang="ts">
	import { ImageOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';

	interface Props {
		imageUrl: string | null;
		ownerImageUrl: string | null;
		categoryPlaceholder: string | null;
		itemName: string;
		status: 'available' | 'unavailable' | 'unknown';
	}

	const { imageUrl, ownerImageUrl, categoryPlaceholder, itemName, status }: Props = $props();

	const statusLabel = $derived(
		status === 'available' ? texts.itemStatus.available :
		status === 'unavailable' ? texts.itemStatus.unavailable :
		texts.itemStatus.unknown
	);
	const statusClass = $derived(
		status === 'available' ? 'bg-green-100 text-green-800 border-green-800' :
		status === 'unavailable' ? 'bg-accent-100 text-accent-800' :
		'bg-gray-100 text-gray-500'
	);
</script>

{#snippet statusBadge()}
	<span class="absolute top-2 left-2 z-10 text-md font-semibold rounded-full border shadow px-3.5 py-2 {statusClass}">
		{statusLabel}
	</span>
{/snippet}

{#if imageUrl}
	<div class="relative w-full max-h-96 overflow-hidden rounded-lg bg-papier flex items-center justify-center">
		<img src={imageUrl} alt="" class="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60" aria-hidden="true" />
		<img src={imageUrl} alt={itemName} class="relative max-h-96 w-full object-contain" />
		{@render statusBadge()}
	</div>
{:else if categoryPlaceholder}
	<div class="w-full h-64 flex flex-col items-center justify-center rounded-lg bg-tinte-100 relative overflow-hidden">
		<img src={categoryPlaceholder} alt="" class="h-40 w-40 object-contain opacity-25" />
		<span class="relative text-sm text-tinte-400">{texts.institutional.imagePlaceholder}</span>
		{@render statusBadge()}
	</div>
{:else if ownerImageUrl}
	<div class="w-full h-64 flex flex-col items-center justify-center rounded-lg bg-tinte-100 relative overflow-hidden">
		<img src={ownerImageUrl} alt="" class="absolute inset-0 w-full h-full object-cover opacity-30" />
		<span class="relative text-sm text-tinte-400">{texts.institutional.imagePlaceholder}</span>
		{@render statusBadge()}
	</div>
{:else}
	<div class="relative w-full h-64 flex flex-col items-center justify-center rounded-lg bg-tinte-100 text-tinte-400 gap-2">
		<ImageOutline class="h-16 w-16" />
		<span class="text-sm">{texts.pages.itemDetail.noImage}</span>
		{@render statusBadge()}
	</div>
{/if}
