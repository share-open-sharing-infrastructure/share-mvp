<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { texts } from '$lib/texts';
	import TrendSparkline from './TrendSparkline.svelte';

	let { data } = $props();

	const t = texts.metrics.admin;

	const LENDING_STATUSES = [
		'pending',
		'accepted',
		'rejected',
		'active',
		'return_requested',
		'completed',
		'aborted',
	] as const;

	const latest = $derived(data.history.at(-1) ?? null);

	const usersTotalSeries = $derived(data.history.map((h) => h.metrics.users.total));
	const itemsAvailableSeries = $derived(data.history.map((h) => h.metrics.items.available));
	const loansCompletedSeries = $derived(data.history.map((h) => h.metrics.loans.completedTotal));
	const historyDates = $derived(data.history.map((h) => h.date));

	function formatRate(rate: number | null): string {
		return rate === null ? t.noAcceptanceRate : `${Math.round(rate * 100)}%`;
	}
</script>

<SeoHead title={texts.seo.adminMetrics.title} robots="noindex, nofollow" />

<div class="mx-auto max-w-5xl space-y-8 p-4">
	<h1 class="text-2xl font-bold text-tinte-900 dark:text-tinte-100">{t.title}</h1>
	<p class="text-sm text-tinte-600 dark:text-tinte-400">{t.liveNotice}</p>

	{#snippet stat(label: string, value: string | number)}
		<div class="rounded-lg border border-tinte-200 bg-papier p-3 dark:border-tinte-700 dark:bg-tinte-900">
			<dt class="text-xs text-tinte-500 dark:text-tinte-400">{label}</dt>
			<dd class="text-xl font-semibold text-tinte-900 dark:text-tinte-100">{value}</dd>
		</div>
	{/snippet}

	<section>
		<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.sections.users}</h2>
		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{@render stat(t.labels.total, data.live.users.total)}
			{@render stat(t.labels.institutions, data.live.users.institutions)}
			{@render stat(t.labels.verified, data.live.users.verified)}
		</dl>
	</section>

	<section>
		<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.sections.items}</h2>
		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{@render stat(t.labels.available, data.live.items.available)}
			{@render stat(t.labels.byPrivateUsers, data.live.items.byPrivateUsers)}
			{@render stat(t.labels.byInstitutionsNative, data.live.items.byInstitutionsNative)}
			{@render stat(t.labels.external, data.live.items.external)}
		</dl>
	</section>

	<section>
		<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.sections.loans}</h2>
		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each LENDING_STATUSES as status (status)}
				{@render stat(t.statusLabels[status], data.live.loans[status])}
			{/each}
		</dl>
	</section>

	<section>
		<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">Trends</h2>
		{#if data.history.length > 1}
			<div class="grid gap-6 sm:grid-cols-3">
				<TrendSparkline label={t.trends.usersTotal} points={usersTotalSeries} dates={historyDates} />
				<TrendSparkline label={t.trends.itemsAvailable} points={itemsAvailableSeries} dates={historyDates} />
				<TrendSparkline label={t.trends.loansCompleted} points={loansCompletedSeries} dates={historyDates} />
			</div>
		{:else}
			<p class="text-sm text-tinte-500">{t.noHistory}</p>
		{/if}
	</section>

	{#if latest}
		<section>
			<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.sections.activeUsers}</h2>
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{@render stat(t.labels.loans30d1plus, latest.metrics.activeUsers.loans30d_1plus)}
				{@render stat(t.labels.loans30d2plus, latest.metrics.activeUsers.loans30d_2plus)}
				{@render stat(t.labels.login7d, latest.metrics.activeUsers.login7d)}
				{@render stat(t.labels.login30d, latest.metrics.activeUsers.login30d)}
			</dl>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.sections.funnel}</h2>
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{@render stat(t.labels.requests30d, latest.metrics.funnel.requests30d)}
				{@render stat(t.labels.acceptanceRate30d, formatRate(latest.metrics.funnel.acceptanceRate30d))}
				{@render stat(t.labels.stalePending, latest.metrics.funnel.stalePending)}
				{@render stat(t.labels.messagesTotal, latest.metrics.messages.total)}
				{@render stat(t.labels.messages30d, latest.metrics.messages.last30d)}
				{@render stat(t.labels.completedTotal, latest.metrics.loans.completedTotal)}
				{@render stat(t.labels.accepted30d, latest.metrics.loans.accepted30d)}
				{@render stat(t.labels.completed30d, latest.metrics.loans.completed30d)}
			</dl>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.sections.impact}</h2>
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each Object.entries(latest.metrics.impact.counterfactual) as [answer, count] (answer)}
					{@render stat(t.impactLabels[answer as keyof typeof t.impactLabels] ?? answer, count)}
				{/each}
			</dl>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.sections.integrations}</h2>
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{@render stat(t.labels.outboundClicksTotal, latest.metrics.outboundClicks.total)}
				{@render stat(t.labels.outboundClicks30d, latest.metrics.outboundClicks.last30d)}
			</dl>
			{#if latest.metrics.integrations.lastSyncByInstitution.length > 0}
				<h3 class="mt-3 mb-1 text-sm font-medium text-tinte-700 dark:text-tinte-300">
					{t.topInstitutionsByItems}
				</h3>
				<ul class="space-y-1 text-sm">
					{#each latest.metrics.integrations.lastSyncByInstitution as inst (inst.userId)}
						<li>{inst.username}: {inst.itemCount}</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold text-tinte-800 dark:text-tinte-200">{t.sections.community}</h2>
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{@render stat(t.labels.groupsTotal, latest.metrics.community.groups.total)}
				{@render stat(t.labels.groupsPublic, latest.metrics.community.groups.public)}
				{@render stat(t.labels.memberships, latest.metrics.community.groups.memberships)}
				{@render stat(t.labels.trustEdges, latest.metrics.community.trusts.edges)}
				{@render stat(t.labels.usersInvited, latest.metrics.community.invites.usersInvited)}
				{@render stat(t.labels.pushSubscriptions, latest.metrics.community.push.subscriptions)}
				{@render stat(t.labels.pushUsersSubscribed, latest.metrics.community.push.usersSubscribed)}
			</dl>
		</section>
	{/if}
</div>
