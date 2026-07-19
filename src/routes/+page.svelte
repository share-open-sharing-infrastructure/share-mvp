<script lang="ts">
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';

	const landingTexts = texts.pages.landing;
	const siteUrl = 'https://allerleih.org';

	const jsonLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: texts.names.app,
		url: siteUrl,
		logo: `${siteUrl}/android-chrome-512x512.png`,
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

	// Hero call-to-action buttons, rendered in order.
	const ctaButtons = [
		{
			href: resolve('/search'),
			label: landingTexts.ctaButtonSearch,
			color: 'bg-primary-300 hover:bg-primary',
		},
		{
			href: resolve('/user/items'),
			label: landingTexts.ctaButtonUpload,
			color: 'bg-accent-300 hover:bg-accent',
		},
	];

	// Info cards, rendered in order. Each body reads: before + link + after.
	// `after` is rendered flush against the link, so include a leading space
	// or punctuation where needed.
	const infoCards = [
		{
			title: landingTexts.how,
			before: '',
			link: { path: '/misc/guide', text: landingTexts.howLinkText },
			after: ` ${landingTexts.howBodyPart1} ${texts.names.app}${landingTexts.howBodyPart2}`,
		},
		{
			title: landingTexts.who,
			before: landingTexts.whoBodyPart1,
			link: { path: '/misc/about', text: landingTexts.whoLinkText },
			after: landingTexts.whoBodyPart2,
		},
		{
			title: landingTexts.support,
			before: landingTexts.supportBodyPart1,
			link: { path: '/misc/contact', text: landingTexts.supportLinkText },
			after: '.',
		},
		{
			title: landingTexts.contribute,
			before: landingTexts.contributeBodyPart1,
			link: { path: '/api/redirect?to=https%3A%2F%2Fallerleih.notion.site%2F36de086dc6ab80f69529e6cf68afe7c4%3Fv%3D36de086dc6ab80869c89000c98bbac63&source=footer', text: landingTexts.contributeLinkText },
			after: landingTexts.contributeBodyPart2,
		},
	] as const;

	// Shared styling — adjust the look here without touching the markup below.
	// `cta-button` is landing-only marketing styling, defined in the style block below;
	// app buttons use $lib/components/ui/Button.svelte instead (docs/design-system.md).
	const styles = {
		ctaButton: 'cta-button inline-flex items-center justify-center w-full sm:w-auto',
		card: 'bg-white rounded-2xl shadow-sm border border-primary-200 p-6 flex flex-col gap-3',
		cardTitle: 'text-xl font-bold text-tinte-900 ',
		cardBody: 'text-base text-tinte-500',
		cardLink: 'text-accent hover:underline font-medium',
	};
</script>

<SeoHead
	title={texts.seo.home.title}
	description={texts.seo.home.description}
	canonical="{siteUrl}/"
	image="{siteUrl}/og-invite.png"
/>

<svelte:head>
	<meta property="og:url" content="{siteUrl}/" />
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
					{landingTexts.tagline} <span class="font-bold text-tinte-700">{landingTexts.city}</span>
				</p>
				<div class="flex flex-col sm:flex-row justify-center gap-3">
					{#each ctaButtons as cta (cta.href)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- cta.href is resolve()d in the ctaButtons array; the rule can't see through the constant -->
						<a href={cta.href} class="{styles.ctaButton} {cta.color}">
							<span class="relative flex w-full items-center justify-center">
								{cta.label}
							</span>
						</a>
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
			{#each infoCards as card (card.title)}
				<div class={styles.card}>
					<h3 class={styles.cardTitle}>{card.title}</h3>
					<p class={styles.cardBody}>
						{card.before}
						<a href={resolve(card.link.path)} class={styles.cardLink}
							>{card.link.text}</a
						>{card.after}
					</p>
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	/* Landing-hero marketing CTA — deliberately outside the app design system. */
	.cta-button {
		color: black;
		border: 1px solid black;
		font-size: larger;
		font-weight: bold;
		font-family: 'Verdana', sans-serif;
		border-radius: 50px;
		cursor: pointer;
		padding: 15px 20px;
		min-width: 18rem;
	}
</style>
