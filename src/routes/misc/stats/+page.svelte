<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import PublicStatsSection from '$lib/components/PublicStatsSection.svelte';
	import { texts } from '$lib/texts';

	let { data } = $props();

	const t = texts.metrics.public;
</script>

<SeoHead
	title={texts.seo.publicStats.title}
	description={texts.seo.publicStats.description}
	canonical
/>

<div class="mx-auto max-w-2xl space-y-6 p-4">
	<h1 class="text-2xl font-bold text-tinte-900 dark:text-tinte-100">{t.title}</h1>
	<p class="text-tinte-600 dark:text-tinte-400">{t.intro}</p>

	{#if data.stats}
		<PublicStatsSection stats={data.stats} />

		<h2 class="pt-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.moreTitle}</h2>
		<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
				<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.groupsTotal}</dt>
				<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{data.stats.groupsTotal}</dd>
			</div>
			<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
				<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.trustEdges}</dt>
				<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{data.stats.trustEdges}</dd>
			</div>
			<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
				<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.messagesTotal}</dt>
				<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{data.stats.messagesTotal}</dd>
			</div>
			<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
				<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.activeUsers30d}</dt>
				<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{data.stats.activeUsers30d}</dd>
			</div>
		</dl>
	{:else}
		<p class="text-sm text-tinte-500">{t.unavailable}</p>
	{/if}
</div>
