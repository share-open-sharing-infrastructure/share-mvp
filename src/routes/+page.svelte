<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { SearchOutline, ShapesOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';

	const t = texts.pages.landing;

	const cardClass =
		'bg-white dark:bg-tinte-800 rounded-2xl shadow-sm border border-primary-200 dark:border-tinte-700 p-6 flex flex-col gap-3';
	const titleClass = 'text-xl font-bold text-tinte-900 dark:text-white';
	const infoParagraphClass = 'text-base text-tinte-500 dark:text-tinte-400';
</script>

<section class="dark:bg-tinte-900 py-12 px-6">
	<div class="max-w-2xl mx-auto text-center">
		<h1
			class="text-5xl font-bold tracking-tight leading-none dark:text-papier mb-4"
		>
			{t.welcome} <span class="text-accent font-extrabold">{texts.names.app}</span>
		</h1>
		<p class="font-light text-tinte-500 lg:text-xl dark:text-tinte-400 mb-8">
			{t.tagline} <span class="font-bold text-tinte-700">{t.city}</span>
		</p>
		<div class="flex flex-col sm:flex-row justify-center gap-3">
			<Button href="/search" class="cta-button w-full sm:w-auto bg-primary-300 hover:bg-primary">
				<span class="relative flex w-full items-center justify-center">
					<SearchOutline class="absolute left-0 h-8 w-8" />
					{t.ctaButtonSearch}
				</span>
			</Button>
			<Button href="/user/items" class="cta-button w-full sm:w-auto bg-accent-300 hover:bg-accent">
				<span class="relative flex w-full items-center justify-center">
					<ShapesOutline class="absolute left-0 h-8 w-8" />
					{t.ctaButtonUpload}
				</span>
			</Button>
		</div>
	</div>
</section>

<section class="bg-primary-100 dark:bg-tinte-900 py-16 px-6">
	<div class="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 text-center">

		<!-- How it works -->
		<div class={cardClass}>
			<h3 class={titleClass}>{t.how}</h3>
			<p class={infoParagraphClass}>
				<a href={resolve('/misc/guide')} class="text-accent hover:underline font-medium">{t.howLinkText}</a>
				{t.howBodyPart1} {texts.names.app} {t.howBodyPart2}
			</p>
		</div>

		<!-- Who we are -->
		<div class={cardClass}>
			<h3 class={titleClass}>{t.who}</h3>
			<p class={infoParagraphClass}>
				{t.whoBodyPart1}
				<a href={resolve('/misc/contact')} class="text-accent hover:underline font-medium">{t.whoLinkText}</a>{t.whoBodyPart2}
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
