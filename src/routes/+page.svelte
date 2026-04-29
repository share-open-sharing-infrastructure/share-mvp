<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';
	import landingimg from '$lib/images/landing-img.png';

	const t = texts.pages.landing;

	const badgeClass =
		'bg-primary-100 text-tinte-900 text-md font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-tinte-700 dark:text-tinte-300';
	const infoParagraphClass = 'text-lg font-normal text-tinte-500 dark:text-tinte-400';
	const ctaButtonClass = 'cta-button text-lg py-4 px-6 sm:px-10 m-3 w-full md:w-xs';
</script>

<section class="dark:bg-tinte-900">
	<div class="grid max-w-7xl px-8 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12">
		<div class="mr-auto place-self-center mt-15 col-span-12 xl:col-span-7">
			<h1
				class="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl dark:text-white"
			>
				{t.welcome} {texts.names.app}
			</h1>
			<p
				class="max-w-2xl mb-6 font-light text-tinte-500 lg:mb-8 md:text-lg lg:text-xl dark:text-tinte-400"
			>
				{t.tagline} <span class="text-accent">{t.city}</span>
			</p>

			<Button href="/search" class={`${ctaButtonClass} bg-primary hover:bg-primary-300`}>
				{t.ctaButtonSearch}
			</Button>
			<Button href="/user/items" class={`${ctaButtonClass} bg-accent hover:bg-accent-300`}>
				{t.ctaButtonUpload}
			</Button>
		</div>
		<div class="hidden">
			<img src={landingimg} alt="landing-png" />
		</div>
	</div>
</section>

<section class="bg-primary-100 dark:bg-tinte-900 antialiased">
	<div class="max-w-7xl px-4 py-8 mx-auto lg:px-6 sm:py-16 lg:py-24">
		<div
			class="grid grid-cols-1 mt-12 text-center sm:mt-16 gap-x-20 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
		>
			<div class="space-y-4">
				<span class={badgeClass}>{t.how}</span>
				<p class={infoParagraphClass}>
					<a href={resolve('/misc/guide')} class="text-accent">{t.howLinkText}</a>
					{t.howBodyPart1} {texts.names.app} {t.howBodyPart2}
				</p>
			</div>

			<div class="space-y-4">
				<span class={badgeClass}>{t.who}</span>
				<p class={infoParagraphClass}>
					{t.whoBodyPart1}
					<a href={resolve('/misc/contact')} class="text-accent">{t.whoLinkText}</a>{t.whoBodyPart2}
				</p>
			</div>

			<div class="space-y-4">
				<span class={badgeClass}>{t.support}</span>
				<p class={infoParagraphClass}>
					{t.supportBodyPart1}
					<a href={resolve('/misc/contact')} class="text-accent">{t.supportLinkText}</a>.
				</p>
			</div>
		</div>
	</div>
</section>