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
	canonical="https://allerleih.org/misc/stats"
/>

<div class="mx-auto max-w-2xl space-y-6 p-4">
	<h1 class="text-2xl font-bold text-tinte-900 dark:text-tinte-100">{t.title}</h1>
	<p class="text-tinte-600 dark:text-tinte-400">{t.intro}</p>

	{#if data.stats}
		<PublicStatsSection stats={data.stats} />
	{:else}
		<p class="text-sm text-tinte-500">{t.unavailable}</p>
	{/if}
</div>
