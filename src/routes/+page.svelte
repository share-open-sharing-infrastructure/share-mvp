<script lang="ts">
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
	import { instance, instanceUrl } from '$lib/instance';
	import { buildRedirectHref } from '$lib/utils/utils';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import PublicStatsSection from '$lib/components/PublicStatsSection.svelte';

	let { data } = $props();

	const landingTexts = texts.pages.landing;
	const statsTexts = texts.metrics.public;

	const jsonLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: texts.names.app,
		url: instance.origin,
		logo: instanceUrl('/icon-512x512.png'),
		description: texts.seo.home.description,
		contactPoint: {
			'@type': 'ContactPoint',
			email: texts.names.mainContactMail,
		},
	});
	// Assembled from parts because literal script tags inside this string confuse
	// the Svelte script-block parsing (svelte2tsx) or would end the block early.
	const jsonLdScriptTag =
		'<' + 'script type="application/ld+json">' + jsonLd + '<' + '/script>';

	// Hero call-to-action buttons, rendered in order. Same shape (variant="primary"),
	// distinguished only by hue.
	const ctaButtons = [
		{
			href: resolve('/search'),
			label: landingTexts.ctaButtonSearch,
			color: 'primary' as const,
		},
		{
			href: resolve('/user/items'),
			label: landingTexts.ctaButtonUpload,
			color: 'accent' as const,
		},
	];

	// Info cards, rendered in order. Each body reads: before + link + after.
	// `after` is rendered flush against the link, so include a leading space
	// or punctuation where needed. Split into two groups so the ESLint
	// `no-navigation-without-resolve` suppression stays scoped to the one anchor that actually
	// needs it: the three internal-route cards call `resolve()` directly at the href in the
	// markup below (a literal call site, so the rule is satisfied with no suppression), while
	// the contribute card's link goes through `buildRedirectHref()` (external redirect-proxy),
	// which the rule cannot see through — its single anchor below carries the disable comment.
	const internalInfoCards = [
		{
			title: landingTexts.how,
			before: '',
			route: '/misc/guide',
			linkText: landingTexts.howLinkText,
			after: ` ${landingTexts.howBodyPart1} ${texts.names.app}${landingTexts.howBodyPart2}`,
		},
		{
			title: landingTexts.who,
			before: landingTexts.whoBodyPart1,
			route: '/misc/about',
			linkText: landingTexts.whoLinkText,
			after: landingTexts.whoBodyPart2,
		},
		{
			title: landingTexts.support,
			before: landingTexts.supportBodyPart1,
			route: '/misc/contact',
			linkText: landingTexts.supportLinkText,
			after: '.',
		},
	] as const;

	const contributeInfoCard = {
		title: landingTexts.contribute,
		before: landingTexts.contributeBodyPart1,
		href: buildRedirectHref(instance.links.contributeBoard, 'footer'),
		linkText: landingTexts.contributeLinkText,
		after: landingTexts.contributeBodyPart2,
	};

	// Shared styling — adjust the look here without touching the markup below.
	const styles = {
		card: 'bg-white rounded-2xl shadow-sm border border-primary-200 p-6 flex flex-col gap-3',
		cardTitle: 'text-xl font-bold text-tinte-900 ',
		cardBody: 'text-base text-tinte-500',
		cardLink: 'text-accent hover:underline font-medium',
	};
</script>

<SeoHead
	title={texts.seo.home.title}
	description={texts.seo.home.description}
	canonical
	image={instanceUrl('/og-invite.png')}
/>

<svelte:head>
	<meta property="og:url" content={instanceUrl('/')} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, self-constructed JSON-LD -->
	{@html jsonLdScriptTag}
</svelte:head>

<div class="flex flex-col gap-16 px-12">
	<!-- Hero: logo, tagline and CTAs next to the explainer video (stacked on mobile) -->
	<section class="dark:bg-tinte-900 antialiased">
		<div
			class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[4fr_3fr] items-center gap-16"
		>
			<div class="text-center lg:text-left">
				<img src="/AllerLeih.png" alt={texts.names.app} class="h-32 mx-auto" />
				<p
					class="text-center text-tinte-500 lg:text-xl dark:text-tinte-400 mb-8"
				>
					{landingTexts.tagline} <span class="font-bold text-tinte-700">{texts.names.city}</span>
				</p>
				<div class="flex flex-col sm:flex-row justify-center gap-3">
					{#each ctaButtons as cta (cta.href)}
						<Button href={cta.href} color={cta.color} size="xl" class="w-full sm:w-auto">
							{cta.label}
						</Button>
					{/each}
				</div>
			</div>
			
			<div class="aspect-video w-full overflow-hidden rounded-2xl">
				<iframe
					class="h-full w-full"
					src="https://fair.tube/videos/embed/je8G5fGCLmsM6mspzPN1tm"
					title={landingTexts.howVideoTitle}
					frameborder="0"
					allow="fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
				></iframe>
			</div>
		</div>
	</section>

	<!-- Info cards: how it works, who we are, current status -->
	<section>
		<div
			class="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center"
		>
			{#each internalInfoCards as card (card.title)}
				<div class={styles.card}>
					<h3 class={styles.cardTitle}>{card.title}</h3>
					<p class={styles.cardBody}>
						{card.before}
						<a href={resolve(card.route)} class={styles.cardLink}
							>{card.linkText}</a
						>{card.after}
					</p>
				</div>
			{/each}
			<div class={styles.card}>
				<h3 class={styles.cardTitle}>{contributeInfoCard.title}</h3>
				<p class={styles.cardBody}>
					{contributeInfoCard.before}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- buildRedirectHref() returns an already-resolved /api/redirect proxy URL; the rule cannot see through the call -->
					<a href={contributeInfoCard.href} class={styles.cardLink}
						>{contributeInfoCard.linkText}</a
					>{contributeInfoCard.after}
				</p>
			</div>
		</div>
	</section>

	<!-- Public transparency numbers: same data as /misc/stats, teased here for visitors -->
	{#if data.stats}
		<section>
			<div class="max-w-6xl mx-auto text-center">
				<h2 class="text-2xl font-bold text-tinte-900 dark:text-tinte-100">{statsTexts.title}</h2>
				<p class="mt-2 text-tinte-500 dark:text-tinte-400">{statsTexts.intro}</p>
				<div class="mt-6">
					<PublicStatsSection stats={data.stats} />
				</div>
				<a href={resolve('/misc/stats')} class="{styles.cardLink} mt-4 inline-block">{statsTexts.linkToFullPage} →</a>
			</div>
		</section>
	{/if}
</div>
