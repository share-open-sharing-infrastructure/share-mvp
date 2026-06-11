<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';

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
	// Assembled from two parts because a literal closing tag would end this script block.
	const jsonLdScriptTag =
		`<script type="application/ld+json">${jsonLd}<` + `/script>`;

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
	const styles = {
		ctaButton: 'cta-button w-full sm:w-auto',
		card: 'bg-white rounded-2xl shadow-sm border border-primary-200 p-6 flex flex-col gap-3',
		cardTitle: 'text-xl font-bold text-tinte-900 ',
		cardBody: 'text-base text-tinte-500',
		cardLink: 'text-accent hover:underline font-medium',
	};
</script>

<svelte:head>
	<title>{texts.seo.home.title}</title>
	<meta name="description" content={texts.seo.home.description} />
	<meta property="og:title" content={texts.seo.home.title} />
	<meta property="og:description" content={texts.seo.home.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{siteUrl}/" />
	<meta property="og:image" content="{siteUrl}/og-invite.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={texts.seo.home.title} />
	<meta name="twitter:description" content={texts.seo.home.description} />
	<link rel="canonical" href="{siteUrl}/" />
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
						<Button href={cta.href} class="{styles.ctaButton} {cta.color}">
							<span class="relative flex w-full items-center justify-center">
								{cta.label}
							</span>
						</Button>
					{/each}
				</div>
			</div>
			<div class="aspect-video w-full overflow-hidden rounded-2xl">
				<iframe
					class="h-full w-full"
					src="https://www.youtube-nocookie.com/embed/IMPZfuff3eI"
					title={landingTexts.howVideoTitle}
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					referrerpolicy="strict-origin-when-cross-origin"
					allowfullscreen
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
