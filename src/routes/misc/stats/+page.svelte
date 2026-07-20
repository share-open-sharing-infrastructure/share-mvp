<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { texts } from '$lib/texts';

	let { data } = $props();

	const t = texts.metrics.public;
</script>

<SeoHead
	title={texts.seo.publicStats.title}
	description={texts.seo.publicStats.description}
	canonical="https://allerleih.org/misc/stats"
/>

<div class="mx-auto max-w-2xl space-y-6 p-4">
	<h1 class="text-2xl font-bold text-tinte-900 dark:text-tinte-100">{t.title}</h1>
	<p class="text-tinte-600 dark:text-tinte-400">{t.intro}</p>

	<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
			<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.usersTotal}</dt>
			<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{data.stats.usersTotal}</dd>
		</div>
		<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
			<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.itemsAvailable}</dt>
			<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{data.stats.itemsAvailable}</dd>
		</div>
		<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
			<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.loansCompleted}</dt>
			<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{data.stats.loansCompleted}</dd>
		</div>
		<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
			<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.impactWouldBuyCount}</dt>
			<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{data.stats.impactWouldBuyCount}</dd>
		</div>
	</dl>
</div>
