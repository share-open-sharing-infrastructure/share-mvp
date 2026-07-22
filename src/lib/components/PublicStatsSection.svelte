<script lang="ts">
	import { texts } from '$lib/texts';
	import type { PublicStats } from '$lib/server/metrics';

	let { stats }: { stats: PublicStats } = $props();

	const t = texts.metrics.public;
</script>

<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
		<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.usersTotal}</dt>
		<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{stats.usersTotal}</dd>
	</div>
	<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
		<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.itemsTotal}</dt>
		<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{stats.itemsTotal}</dd>
	</div>
	<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
		<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.loansCompleted}</dt>
		<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{stats.loansCompleted}</dd>
	</div>
	<div class="rounded-lg border border-tinte-200 bg-papier p-4 dark:border-tinte-700 dark:bg-tinte-900">
		<dt class="text-sm text-tinte-500 dark:text-tinte-400">{t.impactWouldBuyCount}</dt>
		<dd class="text-3xl font-semibold text-tinte-900 dark:text-tinte-100">{stats.impactWouldBuyCount}</dd>
	</div>
</dl>
