<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	import ItemModal from './ItemModal.svelte';
	import UserItemRow from './UserItemRow.svelte';
	import Pagination from './Pagination.svelte';

	let { data, form } = $props();

	let showAddModal = $state(false);
	let searchValue = $state(data.search);
	let debounceTimer: ReturnType<typeof setTimeout>;
	let selectedIds = $state(new Set<string>());

	$effect(() => { searchValue = data.search; });

	$effect(() => {
		// Clear selection when item list changes (navigation, filter)
		data.items;
		selectedIds = new Set();
	});

	function onSearchInput(e: Event) {
		const value = (e.currentTarget as HTMLInputElement).value;
		searchValue = value;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const params = new URLSearchParams(window.location.search);
			params.set('search', value);
			params.set('page', '1');
			goto('?' + params.toString(), { keepFocus: true });
		}, 300);
	}

	function onStatusChange(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value;
		const params = new URLSearchParams(window.location.search);
		params.set('status', value);
		params.set('page', '1');
		goto('?' + params.toString());
	}

	function toggleSelectAll(checked: boolean) {
		selectedIds = checked ? new Set(data.items.map((i) => i.id)) : new Set();
	}

	function updateSelection(id: string, v: boolean) {
		const next = new Set(selectedIds);
		if (v) next.add(id); else next.delete(id);
		selectedIds = next;
	}

	const allSelected = $derived(
		data.items.length > 0 && data.items.every((i) => selectedIds.has(i.id))
	);
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="text-2xl tracking-tight font-extrabold text-tinte-900 dark:text-white">
			{texts.pages.items.title}
		</h2>
		<div>
			{#if data.totalItems > 0}
				<span class="text-accent">{texts.pages.items.countSome(data.totalItems)}</span>
			{:else}
				{texts.pages.items.countNone}
			{/if}
		</div>
	</div>
</div>

<section class="bg-secondary-100 dark:bg-tinte-900 min-h-screen">
	<div class="max-w-7xl mx-auto px-4 pt-6">

		<!-- Action buttons -->
		<div class="flex flex-col sm:flex-row gap-4 mb-6">
			<Button
				onclick={() => { showAddModal = true; }}
				class="flex-1 cursor-pointer flex items-center justify-center gap-2 py-3 text-base font-semibold rounded-full shadow-sm border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-100 dark:border-primary-700"
			>
				<span class="text-xl">📦</span>
				{texts.pages.items.addSingle}
			</Button>
			<Button
				href="/user/items/bulk-add"
				class="flex-1 flex items-center justify-center gap-2 py-3 text-base font-semibold rounded-full shadow-sm border border-primary-400 bg-primary-100 hover:bg-primary-200 text-accent-800 dark:bg-accent-900 dark:text-accent-100 dark:border-accent-700"
			>
				<span class="text-xl">✨</span>
				{texts.pages.items.addBulk}
			</Button>
		</div>

		<!-- Filter bar -->
		<div class="flex flex-col sm:flex-row gap-3 mb-4">
			<input
				type="search"
				value={searchValue}
				oninput={onSearchInput}
				placeholder={texts.pages.items.search}
				class="flex-1 rounded-full border border-tinte-300 bg-papier px-4 py-2 text-sm text-tinte-900 placeholder-tinte-400 focus:border-primary focus:ring-primary dark:border-tinte-600 dark:bg-tinte-700 dark:text-white"
			/>
			<select
				onchange={onStatusChange}
				class="rounded-full border border-tinte-300 bg-papier px-3 py-2 text-sm text-tinte-900 focus:border-primary focus:ring-primary dark:border-tinte-600 dark:bg-tinte-700 dark:text-white"
			>
				<option value="all" selected={data.statusFilter === 'all'}>{texts.pages.items.filterAll}</option>
				<option value="available" selected={data.statusFilter === 'available'}>{texts.pages.items.filterAvailable}</option>
				<option value="unavailable" selected={data.statusFilter === 'unavailable'}>{texts.pages.items.filterUnavailable}</option>
			</select>
		</div>

		<!-- Bulk delete error -->
		{#if form && 'bulkBlocked' in form && form.conversationIds?.length}
			<div class="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
				<p>{form.message}</p>
				<a href="/conversations" class="mt-1 inline-block font-semibold underline">
					{texts.pages.items.linkToConversations}
				</a>
			</div>
		{/if}

		<!-- Bulk action bar -->
		{#if selectedIds.size > 0}
			<div class="flex flex-wrap items-center gap-3 mb-3 px-4 py-2 rounded-lg bg-primary-50 border border-primary-200 dark:bg-primary-900/30 dark:border-primary-700">
				<span class="text-sm font-medium text-primary-800 dark:text-primary-200">
					{texts.pages.items.selected(selectedIds.size)}
				</span>
				<form
					method="POST"
					action="?/bulkSetStatus"
					use:enhance={() => async ({ update }) => update({ reset: false })}
				>
					{#each [...selectedIds] as id(id)}
						<input type="hidden" name="itemId" value={id} />
					{/each}
					<input type="hidden" name="newStatus" value="available" />
					<button
						type="submit"
						class="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 cursor-pointer transition-colors"
					>
						{texts.pages.items.setAvailable}
					</button>
				</form>
				<form
					method="POST"
					action="?/bulkSetStatus"
					use:enhance={() => async ({ update }) => update({ reset: false })}
				>
					{#each [...selectedIds] as id(id)}
						<input type="hidden" name="itemId" value={id} />
					{/each}
					<input type="hidden" name="newStatus" value="unavailable" />
					<button
						type="submit"
						class="text-xs font-semibold px-3 py-1 rounded-full bg-accent-100 text-accent-800 border border-accent-300 hover:bg-accent-200 cursor-pointer transition-colors"
					>
						{texts.pages.items.setUnavailable}
					</button>
				</form>
				<form
					method="POST"
					action="?/bulkDelete"
					use:enhance={({ cancel, formData }) => {
						if (!confirm(texts.pages.items.bulkDeleteConfirm(selectedIds.size))) {
							cancel();
							return;
						}
						const submitted = new Set(formData.getAll('itemId') as string[]);
						return async ({ update }) => {
							await update({ reset: false });
							for (const id of submitted) selectedIds.delete(id);
							selectedIds = new Set(selectedIds);
						};
					}}
				>
					{#each [...selectedIds] as id(id)}
						<input type="hidden" name="itemId" value={id} />
					{/each}
					<button
						type="submit"
						class="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-300 hover:bg-red-200 cursor-pointer transition-colors"
					>
						{texts.pages.items.bulkDelete}
					</button>
				</form>
				<button
					type="button"
					onclick={() => { selectedIds = new Set(); }}
					class="ml-auto text-xs text-tinte-500 hover:text-tinte-700 dark:hover:text-tinte-300 cursor-pointer"
				>
					{texts.pages.items.deselectAll}
				</button>
			</div>
		{/if}

		<!-- List -->
		{#if data.items.length > 0}
			<div class="rounded-xl border border-tinte-200 dark:border-tinte-700 bg-papier dark:bg-tinte-800 overflow-hidden">
				<!-- List header -->
				<div class="flex items-center gap-3 px-4 py-2 bg-tinte-50 dark:bg-tinte-900 border-b border-tinte-200 dark:border-tinte-700">
					<input
						type="checkbox"
						checked={allSelected}
						onchange={(e) => toggleSelectAll((e.currentTarget as HTMLInputElement).checked)}
						class="w-4 h-4 rounded border-tinte-300 text-primary-600 cursor-pointer"
						aria-label={texts.pages.items.selectAll}
					/>
					<span class="text-xs text-tinte-500 dark:text-tinte-400">{texts.pages.items.selectAll}</span>
				</div>

				{#each data.items as item (item.id)}
					<UserItemRow
						{item}
						PB_URL={data.PB_URL}
						groups={data.attachableGroups}
						{form}
						selected={selectedIds.has(item.id)}
						onselectedchange={(v) => updateSelection(item.id, v)}
					/>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center text-center text-tinte-500 py-12">
				<p>{texts.ui.noItemsYet}</p>
			</div>
		{/if}

		<!-- Pagination -->
		<Pagination currentPage={data.currentPage} totalPages={data.totalPages} />

	</div>
</section>

<!-- Add Modal -->
<ItemModal bind:isVisible={showAddModal} type="add" groups={data.attachableGroups} {form} />
