<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	interface Props {
		page: number;
		totalPages: number;
		perPage: number;
		q: string;
		selectedCategories: string[];
		op: 'or' | 'and';
	}

	let { page, totalPages, perPage, q, selectedCategories, op }: Props = $props();

	const perPageOptions = [10, 20, 50];

	function pageUrl(n: number): string {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		params.set('page', String(n));
		params.set('perPage', String(perPage));
		if (selectedCategories.length > 0) params.set('cats', selectedCategories.join(','));
		if (op === 'and') params.set('op', 'and');
		return resolve('/search') + '?' + params.toString();
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
	<div class="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
		<!-- Per-page selector: GET form so no goto() needed -->
		<form method="GET" action={resolve('/search')} class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
			<input type="hidden" name="q" value={q} />
			<input type="hidden" name="page" value="1" />
			{#if selectedCategories.length > 0}
				<input type="hidden" name="cats" value={selectedCategories.join(',')} />
			{/if}
			{#if op === 'and'}
				<input type="hidden" name="op" value="and" />
			{/if}
			<span>{texts.pages.search.perPage}</span>
			<select
				name="perPage"
				onchange={(e) => (e.currentTarget as HTMLSelectElement).form?.submit()}
				class="w-14 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			>
				{#each perPageOptions as opt (opt)}
					<option value={opt} selected={opt === perPage}>{opt}</option>
				{/each}
			</select>
		</form>

		<!-- Page controls -->
		<div class="flex items-center gap-1">
			<!-- Prev -->
			{#if page > 1}
				<a
					href={pageUrl(page - 1)}
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-sm text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
					aria-label="Vorherige Seite"
				>‹</a>
			{:else}
				<span class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed">‹</span>
			{/if}

			<!-- Page numbers -->
			{#each getPages() as p (p === '...' ? `ellipsis-${Math.random()}` : p)}
				{#if p === '...'}
					<span class="flex h-8 w-8 items-center justify-center text-sm text-gray-400">…</span>
				{:else if p === page}
					<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
						{p}
					</span>
				{:else}
					<a
						href={pageUrl(p)}
						class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-sm text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
					>{p}</a>
				{/if}
			{/each}

			<!-- Next -->
			{#if page < totalPages}
				<a
					href={pageUrl(page + 1)}
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-sm text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
					aria-label="Nächste Seite"
				>›</a>
			{:else}
				<span class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed">›</span>
			{/if}
		</div>

		<!-- Page info -->
		<span class="text-sm text-gray-500 dark:text-gray-400">
			{texts.pages.search.pageInfo(page, totalPages)}
		</span>
	</div>
{/if}
