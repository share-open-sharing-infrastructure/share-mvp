<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { buildSearchUrl } from './searchUrl';

	interface Props {
		page: number;
		totalPages: number;
		perPage: number;
		q: string;
		selectedCategories: string[];
		onlyAvailable: boolean;
		ownerType: string;
	}

	let { page, totalPages, perPage, q, selectedCategories, onlyAvailable, ownerType }: Props = $props();

	const perPageOptions = [10, 20, 50];

	function pageUrl(n: number): string {
		return buildSearchUrl({ q, page: n, perPage, cats: selectedCategories, onlyAvailable, ownerType });
	}

	function getPages(): (number | '...')[] {
		if (totalPages <= 7) {
			return Array.from({ length: totalPages }, (_, i) => i + 1);
		}
		const pages: (number | '...')[] = [1];
		if (page > 3) pages.push('...');
		for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
			pages.push(i);
		}
		if (page < totalPages - 2) pages.push('...');
		pages.push(totalPages);
		return pages;
	}
</script>

{#if totalPages > 0}
	<div class="mt-6 flex flex-row sm:flex-row flex-nowrap items-center justify-between gap-3">
		<div class="flex flex-1 hidden sm:block"></div>

		<!-- Page controls -->
		<div class="flex items-center gap-1">
			<!-- Prev -->
			{#if page > 1}
				<a
					href={pageUrl(page - 1)}
					class="flex h-8 w-8 items-center justify-center rounded-full border border-tinte-300 bg-sand text-sm text-tinte-500 hover:bg-tinte-100 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400 dark:hover:bg-tinte-700"
					aria-label="Vorherige Seite"
				>‹</a>
			{:else}
				<span class="flex h-8 w-8 items-center justify-center rounded-full border border-tinte-200 bg-papier text-sm text-tinte-300 dark:border-tinte-700 dark:bg-tinte-800 dark:text-tinte-600 cursor-not-allowed">‹</span>
			{/if}

			<!-- Page numbers -->
			{#each getPages() as p, i (p === '...' ? `ellipsis-${i}` : p)}
				{#if p === '...'}
					<span class="flex h-8 w-8 items-center justify-center text-sm text-tinte-400">…</span>
				{:else if p === page}
					<span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
						{p}
					</span>
				{:else}
					<a
						href={pageUrl(p)}
						class="flex h-8 w-8 items-center justify-center rounded-full border border-tinte-300 bg-sand text-sm text-tinte-500 hover:bg-tinte-100 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400 dark:hover:bg-tinte-700"
					>{p}</a>
				{/if}
			{/each}

			<!-- Next -->
			{#if page < totalPages}
				<a
					href={pageUrl(page + 1)}
					class="flex h-8 w-8 items-center justify-center rounded-full border border-tinte-300 bg-sand text-sm text-tinte-500 hover:bg-tinte-100 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400 dark:hover:bg-tinte-700"
					aria-label="Nächste Seite"
				>›</a>
			{:else}
				<span class="flex h-8 w-8 items-center justify-center rounded-full border border-tinte-200 bg-papier text-sm text-tinte-300 dark:border-tinte-700 dark:bg-tinte-800 dark:text-tinte-600 cursor-not-allowed">›</span>
			{/if}
		</div>

		<!-- Per-page selector: GET form so no goto() needed -->
		<form method="GET" action={resolve('/search')} class="flex flex-1 justify-end items-center gap-2 text-sm text-tinte-600 dark:text-tinte-400">
			<input type="hidden" name="q" value={q} />
			<input type="hidden" name="page" value="1" />
			{#if selectedCategories.length > 0}
				<input type="hidden" name="cats" value={selectedCategories.join(',')} />
			{/if}
			{#if !onlyAvailable}
				<input type="hidden" name="onlyAvailable" value="false" />
			{/if}
			{#if ownerType !== 'all'}
				<input type="hidden" name="ownerType" value={ownerType} />
			{/if}
			<span>{texts.pages.search.perPage}</span>
			<select
				name="perPage"
				onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.submit()}
				class="w-14 rounded-full border border-tinte-300 bg-papier px-2 py-1 text-sm text-tinte-900 focus:border-primary focus:ring-primary dark:border-tinte-600 dark:bg-tinte-700 dark:text-white"
			>
				{#each perPageOptions as opt (opt)}
					<option value={opt} selected={opt === perPage}>{opt}</option>
				{/each}
			</select>
		</form>
	</div>
{/if}
