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

	/** "YYYY-MM-DD" -> "TT.MM.JJJJ". */
	function formatGermanDate(iso: string): string {
		const [y, m, d] = iso.split('-');
		return `${d}.${m}.${y}`;
	}
</script>

<SeoHead title={texts.seo.adminMetrics.title} robots="noindex, nofollow" />

<div class="mx-auto max-w-5xl space-y-8 p-4">
	<h1 class="text-2xl font-bold text-tinte-900 dark:text-tinte-100">{t.title}</h1>

	{#snippet stat(label: string, value: string | number)}
		<div class="rounded-lg border border-tinte-200 bg-papier p-3 dark:border-tinte-700 dark:bg-tinte-900">
			<dt class="text-xs text-tinte-500 dark:text-tinte-400">{label}</dt>
			<dd class="text-xl font-semibold text-tinte-900 dark:text-tinte-100">{value}</dd>
		</div>
	{/snippet}

	{#snippet groupBadge(text: string, tone: 'live' | 'snapshot')}
		<span
			class="rounded-full px-2.5 py-0.5 text-xs font-semibold {tone === 'live'
				? 'bg-safety/20 text-tinte-900 dark:bg-safety/25 dark:text-tinte-50'
				: 'bg-tinte-200 text-tinte-700 dark:bg-tinte-700 dark:text-tinte-200'}"
		>
			{text}
		</span>
	{/snippet}

	<!-- LIVE group: computed fresh on every page load. Green accent border signals "current". -->
	<div class="space-y-6 rounded-xl border-l-4 border-safety bg-safety/10 p-4">
		<div class="flex items-center gap-2">
			<h2 class="text-lg font-bold text-tinte-900 dark:text-tinte-100">{t.liveGroupTitle}</h2>
			{@render groupBadge(t.liveBadge, 'live')}
		</div>

		<section>
			<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">{t.sections.users}</h3>
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{@render stat(t.labels.total, data.live.users.total)}
				{@render stat(t.labels.institutions, data.live.users.institutions)}
				{@render stat(t.labels.verified, data.live.users.verified)}
			</dl>
		</section>

		<section>
			<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">{t.sections.items}</h3>
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{@render stat(t.labels.available, data.live.items.available)}
				{@render stat(t.labels.byPrivateUsers, data.live.items.byPrivateUsers)}
				{@render stat(t.labels.byInstitutionsNative, data.live.items.byInstitutionsNative)}
				{@render stat(t.labels.external, data.live.items.external)}
			</dl>
		</section>

		<section>
			<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">{t.sections.loans}</h3>
			<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each LENDING_STATUSES as status (status)}
					{@render stat(t.statusLabels[status], data.live.loans[status])}
				{/each}
			</dl>
		</section>
	</div>

	<!-- SNAPSHOT group: everything below comes from the latest metrics_daily row (last
	     nightly cron run), not the current moment. Neutral tone + explicit "Stand: …" date
	     signals "this is as of last night", distinct from the live group above. -->
	<div class="space-y-6 rounded-xl border-l-4 border-tinte-400 bg-sand/40 p-4 dark:border-tinte-600 dark:bg-tinte-800/40">
		<div class="flex items-center gap-2">
			<h2 class="text-lg font-bold text-tinte-900 dark:text-tinte-100">{t.snapshotGroupTitle}</h2>
			{@render groupBadge(latest ? t.snapshotBadge(formatGermanDate(latest.date)) : t.noHistory, 'snapshot')}
		</div>

		<section>
			<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">Trends</h3>
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
				<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">{t.sections.activeUsers}</h3>
				<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{@render stat(t.labels.loans30d1plus, latest.metrics.activeUsers.loans30d_1plus)}
					{@render stat(t.labels.loans30d2plus, latest.metrics.activeUsers.loans30d_2plus)}
					{@render stat(t.labels.login7d, latest.metrics.activeUsers.login7d)}
					{@render stat(t.labels.login30d, latest.metrics.activeUsers.login30d)}
				</dl>
			</section>

			<section>
				<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">{t.sections.funnel}</h3>
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
				<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">{t.sections.impact}</h3>
				<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{#each Object.entries(latest.metrics.impact.counterfactual) as [answer, count] (answer)}
						{@render stat(t.impactLabels[answer as keyof typeof t.impactLabels] ?? answer, count)}
					{/each}
				</dl>
			</section>

			<section>
				<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">{t.sections.integrations}</h3>
				<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{@render stat(t.labels.outboundClicksTotal, latest.metrics.outboundClicks.total)}
					{@render stat(t.labels.outboundClicks30d, latest.metrics.outboundClicks.last30d)}
				</dl>
				{#if latest.metrics.integrations.lastSyncByInstitution.length > 0}
					<h4 class="mt-3 mb-1 text-sm font-medium text-tinte-700 dark:text-tinte-300">
						{t.topInstitutionsByItems}
					</h4>
					<ul class="space-y-1 text-sm">
						{#each latest.metrics.integrations.lastSyncByInstitution as inst (inst.userId)}
							<li>{inst.username}: {inst.itemCount}</li>
						{/each}
					</ul>
				{/if}
				{#if latest.metrics.outboundClicks.byDomain30d.length > 0}
					<h4 class="mt-3 mb-1 text-sm font-medium text-tinte-700 dark:text-tinte-300">
						{t.topOutboundDomains}
					</h4>
					<ul class="space-y-1 text-sm">
						{#each latest.metrics.outboundClicks.byDomain30d as entry (entry.domain)}
							<li>{entry.domain}: {entry.count}</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section>
				<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">{t.sections.community}</h3>
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
</div>
