<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';

	const t = texts.pages.landing;

	const cardClass =
		'bg-white dark:bg-tinte-800 rounded-2xl shadow-sm border border-primary-200 dark:border-tinte-700 p-6 flex flex-col gap-3';
	const titleClass = 'text-xl font-bold text-tinte-900 dark:text-white';
	const infoParagraphClass = 'text-base text-tinte-500 dark:text-tinte-400';
</script>

<svelte:head>
	<title>{texts.seo.home.title}</title>
	<meta name="description" content={texts.seo.home.description} />
	<meta property="og:title" content={texts.seo.home.title} />
	<meta property="og:description" content={texts.seo.home.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://allerleih.org/" />
	<meta property="og:image" content="https://allerleih.org/og-invite.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={texts.seo.home.title} />
	<meta name="twitter:description" content={texts.seo.home.description} />
	<link rel="canonical" href="https://allerleih.org/" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: 'AllerLeih',
		url: 'https://allerleih.org',
		logo: 'https://allerleih.org/android-chrome-512x512.png',
		description: texts.seo.home.description,
		contactPoint: { '@type': 'ContactPoint', email: texts.names.mainContactMail },
	})}</script>`}
</svelte:head>

<section class="dark:bg-tinte-900 py-12 px-6 antialiased">
	<div class="max-w-2xl mx-auto text-center items-center">
		<!-- <h1
			class="text-5xl font-bold tracking-tight leading-none dark:text-papier mb-4"
		>
			{t.welcome} 
			
		</h1> -->
		<img src="/AllerLeih.png" alt={texts.names.app} class="h-32 mx-auto mb-4" />
		<p class="font-light text-tinte-500 lg:text-xl dark:text-tinte-400 mb-8">
			{t.tagline} <span class="font-bold text-tinte-700">{t.city}</span>
		</p>
		<div class="flex flex-col sm:flex-row justify-center gap-3">
			<Button href="/search" class="cta-button w-full sm:w-auto bg-primary-300 hover:bg-primary">
				<span class="relative flex w-full items-center justify-center">
					<!-- <img src="/icons/search_icon.svg" alt="" class="absolute left-0 h-8 w-8" /> -->
					{t.ctaButtonSearch}
				</span>
			</Button>
			<Button href="/user/items" class="cta-button w-full sm:w-auto bg-accent-300 hover:bg-accent">
				<span class="relative flex w-full items-center justify-center">
					<!-- <img src="/icons/offer_icon.svg" alt="" class="absolute left-0 h-12 w-12" /> -->
					{t.ctaButtonUpload}
				</span>
			</Button>
		</div>
	</div>
</section>

<section class="py-16 px-6">
	<div class="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 text-center">

		<!-- How it works -->
		<div class={cardClass}>
			<h3 class={titleClass}>{t.how}</h3>
			<p class={infoParagraphClass}>
				<a href={resolve('/misc/guide')} class="text-accent hover:underline font-medium">{t.howLinkText}</a>
				{t.howBodyPart1} {texts.names.app}, <a href="https://www.youtube.com/watch?v=IMPZfuff3eI" target="_blank" rel="noopener noreferrer" class="text-accent hover:underline font-medium">{t.howVideoLinkText}</a>{t.howBodyPart2}
			</p>
			<p class={infoParagraphClass}>
				
			</p>
		</div>

		<!-- Who we are -->
		<div class={cardClass}>
			<h3 class={titleClass}>{t.who}</h3>
			<p class={infoParagraphClass}>
				{t.whoBodyPart1}
				<a href={resolve('/misc/about')} class="text-accent hover:underline font-medium">{t.whoLinkText}</a>{t.whoBodyPart2}
			</p>
		</div>

		<!-- Current status / support -->
		<div class={cardClass}>
			<h3 class={titleClass}>{t.support}</h3>
			<p class={infoParagraphClass}>
				{t.supportBodyPart1}
				<a href={resolve('/misc/contact')} class="text-accent hover:underline font-medium">{t.supportLinkText}</a>.
			</p>
		</div>

	</div>
</section>


