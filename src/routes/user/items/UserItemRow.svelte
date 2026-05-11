<script lang="ts">
	import type { Item } from '$lib/types/models';
	import { enhance } from '$app/forms';
	import { Badge } from 'flowbite-svelte';
	import ItemModal from './ItemModal.svelte';
	import { texts } from '$lib/texts';
	import { getCategoryPlaceholder } from '$lib/utils/categoryPlaceholder';

	interface Props {
		item: Item;
		PB_URL: string;
		selected: boolean;
		onselectedchange: (v: boolean) => void;
	}
	let { item, PB_URL, selected, onselectedchange }: Props = $props();

	let showEditModal = $state(false);
	let optimisticStatus = $state(item.status);
	$effect(() => { optimisticStatus = item.status; });

	function getRealImageUrl(i: Item): string | null {
		if (i.image) return `${PB_URL}api/files/${i.collectionId}/${i.id}/${i.image}`;
		return i.externalImgUrl ?? null;
	}
</script>

<div
	class="flex items-center gap-3 px-4 py-2 border-b border-tinte-100 dark:border-tinte-700 hover:bg-sand dark:hover:bg-tinte-800 transition-colors"
>
	<!-- Checkbox -->
	<input
		type="checkbox"
		checked={selected}
		onchange={(e) => onselectedchange((e.currentTarget as HTMLInputElement).checked)}
		class="w-4 h-4 rounded border-tinte-300 text-primary-600 cursor-pointer shrink-0"
		aria-label={item.name}
	/>

	<!-- Thumbnail -->
	{#if getRealImageUrl(item)}
		<img src={getRealImageUrl(item)!} alt={item.name} class="w-10 h-10 rounded object-cover shrink-0" />
	{:else}
		<div class="w-10 h-10 rounded shrink-0 bg-gray-100 flex items-center justify-center overflow-hidden">
			{#if getCategoryPlaceholder(item.categories)}
				<img src={getCategoryPlaceholder(item.categories)!} alt="" class="w-full h-full object-contain p-1 opacity-40" />
			{/if}
		</div>
	{/if}

	<!-- Name + badges -->
	<div class="flex-1 flex items-center gap-2 min-w-0">
		<a href="/items/{item.id}" class="font-semibold text-sm text-tinte-900 dark:text-white truncate hover:underline sm:max-w-[40%] sm:min-w-32">{item.name}</a>
		{#if item.description}
			<span class="hidden sm:block text-xs text-tinte-400 dark:text-tinte-500 truncate min-w-0">{item.description}</span>
		{/if}
		{#if item.trusteesOnly}
			<Badge rounded border color="green" class="shrink-0">
				<span class="text-green-900 bg-green-100 text-xs">{texts.ui.trustedOnly}</span>
			</Badge>
		{/if}
	</div>

	<!-- Inline status toggle -->
	<form
		method="POST"
		action="?/toggleStatus"
		use:enhance={() => {
			optimisticStatus = optimisticStatus === 'available' ? 'unavailable' : 'available';
			return async ({ update }) => update({ reset: false });
		}}
	>
		<input type="hidden" name="itemId" value={item.id} />
		<button
			type="submit"
			title={optimisticStatus === 'available' ? 'Als nicht verfügbar markieren' : 'Als verfügbar markieren'}
			class="shrink-0 p-1.5 rounded hover:bg-tinte-100 dark:hover:bg-tinte-700 transition-colors cursor-pointer
				{optimisticStatus === 'available' ? 'text-green-600' : 'text-red-500'}"
		>
			{#if optimisticStatus === 'available'}
				<!-- eye icon — green = available -->
				<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
				</svg>
			{:else}
				<!-- eye-off icon — red = unavailable -->
				<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
				</svg>
			{/if}
		</button>
	</form>

	<!-- Edit button -->
	<button
		type="button"
		onclick={() => (showEditModal = true)}
		title="Bearbeiten"
		class="shrink-0 p-1.5 rounded text-tinte-400 hover:text-tinte-700 dark:hover:text-tinte-200 hover:bg-tinte-100 dark:hover:bg-tinte-700 transition-colors cursor-pointer"
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
		</svg>
	</button>
</div>

<ItemModal
	bind:isVisible={showEditModal}
	type="edit"
	editingItem={item}
	imgUrl={getRealImageUrl(item) ?? getCategoryPlaceholder(item.categories) ?? ''}
/>
