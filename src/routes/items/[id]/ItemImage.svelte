<script lang="ts">
	import { ImageOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';

	interface Props {
		/** All image URLs for this item, cover first. Empty when there is no uploaded image. */
		imageUrls: string[];
		ownerImageUrl: string | null;
		categoryPlaceholder: string | null;
		itemName: string;
		status: 'available' | 'unavailable' | 'unknown';
	}

	const { imageUrls, ownerImageUrl, categoryPlaceholder, itemName, status }: Props = $props();

	let activeIndex = $state(0);
	// Guard against the index pointing past the list (e.g. after a data refresh).
	const activeUrl = $derived(imageUrls[activeIndex] ?? imageUrls[0] ?? null);

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

{#if activeUrl}
	<div class="space-y-2">
		<div class="relative w-full max-h-96 overflow-hidden rounded-lg bg-papier flex items-center justify-center">
			<img src={activeUrl} alt="" class="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60" aria-hidden="true" />
			<img src={activeUrl} alt={itemName} class="relative max-h-96 w-full object-contain" />
			{@render statusBadge()}
		</div>
		{#if imageUrls.length > 1}
			<div class="flex flex-wrap gap-2">
				{#each imageUrls as url, i (url)}
					<button
						type="button"
						onclick={() => (activeIndex = i)}
						aria-label={texts.pages.itemDetail.showImage(i + 1)}
						aria-current={i === activeIndex}
						class="h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors {i === activeIndex
							? 'border-primary-500'
							: 'border-transparent hover:border-tinte-300'}"
					>
						<img src={url} alt="" class="h-full w-full object-cover" />
					</button>
				{/each}
			</div>
		{/if}
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
