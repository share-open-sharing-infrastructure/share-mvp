<script lang="ts">
	import { page } from '$app/stores';

	interface Props {
		currentPage: number;
		totalPages: number;
	}
	let { currentPage, totalPages }: Props = $props();

	function pageUrl(n: number): string {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(n));
		return '?' + params.toString();
	}

	function getPages(): (number | '...')[] {
		if (totalPages <= 7) {
			return Array.from({ length: totalPages }, (_, i) => i + 1);
		}
		const pages: (number | '...')[] = [1];
		if (currentPage > 3) pages.push('...');
		for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
			pages.push(i);
		}
		if (currentPage < totalPages - 2) pages.push('...');
		pages.push(totalPages);
		return pages;
	}
</script>

{#if totalPages > 1}
	<div class="mt-6 flex items-center justify-center gap-1">
		<!-- Prev -->
		{#if currentPage > 1}
			<a
				href={pageUrl(currentPage - 1)}
				class="flex h-8 w-8 items-center justify-center rounded-lg border border-tinte-300 bg-sand text-sm text-tinte-500 hover:bg-tinte-100 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400 dark:hover:bg-tinte-700"
				aria-label="Vorherige Seite"
			>‹</a>
		{:else}
			<span class="flex h-8 w-8 items-center justify-center rounded-lg border border-tinte-200 bg-papier text-sm text-tinte-300 dark:border-tinte-700 dark:bg-tinte-800 dark:text-tinte-600 cursor-not-allowed">‹</span>
		{/if}

		{#each getPages() as p, i (p === '...' ? `ellipsis-${i}` : p)}
			{#if p === '...'}
				<span class="flex h-8 w-8 items-center justify-center text-sm text-tinte-400">…</span>
			{:else if p === currentPage}
				<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">{p}</span>
			{:else}
				<a
					href={pageUrl(p)}
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-tinte-300 bg-sand text-sm text-tinte-500 hover:bg-tinte-100 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400 dark:hover:bg-tinte-700"
				>{p}</a>
			{/if}
		{/each}

		<!-- Next -->
		{#if currentPage < totalPages}
			<a
				href={pageUrl(currentPage + 1)}
				class="flex h-8 w-8 items-center justify-center rounded-lg border border-tinte-300 bg-sand text-sm text-tinte-500 hover:bg-tinte-100 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400 dark:hover:bg-tinte-700"
				aria-label="Nächste Seite"
			>›</a>
		{:else}
			<span class="flex h-8 w-8 items-center justify-center rounded-lg border border-tinte-200 bg-papier text-sm text-tinte-300 dark:border-tinte-700 dark:bg-tinte-800 dark:text-tinte-600 cursor-not-allowed">›</span>
		{/if}
	</div>
{/if}
