<script lang="ts">
	import { Button, Popover } from 'flowbite-svelte';
	import { ChevronRightOutline, ShapesOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';

	const t = texts.pages.landing;

	const cardClass =
		'bg-white dark:bg-tinte-800 rounded-2xl shadow-sm border border-primary-200 dark:border-tinte-700 p-6 flex flex-col gap-3';
	const titleClass = 'text-xl font-bold text-tinte-900 dark:text-white';
	const infoParagraphClass = 'text-base text-tinte-500 dark:text-tinte-400';
</script>

<section class="dark:bg-tinte-900 py-12 px-6">
	<div class="max-w-2xl mx-auto text-center items-center">
		<h1
			class="text-5xl font-bold tracking-tight leading-none dark:text-papier mb-4"
		>
			{t.welcome} 
			<!-- <span class="text-accent font-extrabold">{texts.names.app}</span> -->
		</h1>
		<div id="beta" class="relative flex flex-col items-center">
				<img src="/AllerLeih.svg" alt={texts.names.app} class="h-32 mx-auto mb-4" />
				<span 
						class="absolute top-9 right-25 text-[40px] rotate-90 font-bold tracking-widest uppercase border-2 border-red-500 text-red-500 rounded px-1 opacity-80 leading-tight pointer-events-none"
					>
						Beta
					</span>
			</div>
		
		<p class="font-light text-tinte-500 lg:text-xl dark:text-tinte-400 mb-8">
			{t.tagline} <span class="font-bold text-tinte-700">{t.city}</span>
		</p>
		<div class="flex flex-col sm:flex-row justify-center gap-3">
			<Button href="/search" class="cta-button w-full sm:w-auto bg-primary-300 hover:bg-primary">
				<span class="relative flex w-full items-center justify-center">
					<img src="/icons/search_icon.svg" alt="" class="absolute left-0 h-8 w-8" />
					{t.ctaButtonSearch}
				</span>
			</Button>
			<Button href="/user/items" class="cta-button w-full sm:w-auto bg-accent-300 hover:bg-accent">
				<span class="relative flex w-full items-center justify-center">
					<img src="/icons/offer_icon.svg" alt="" class="absolute left-0 h-12 w-12" />
					{t.ctaButtonUpload}
				</span>
			</Button>
		</div>
	</div>
</section>

<section class="bg-papier dark:bg-tinte-900 py-16 px-6">
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


	<Popover
		triggeredBy="#beta"
		class="w-72 bg-sand text-sm font-light text-tinte-500 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400"
		placement="bottom-start"
	>
		<div class="space-y-2 p-3">
			<h3 class="font-semibold text-tinte-900 dark:text-white">
				Beta-Zugang
			</h3>
			Wir testen AllerLeih gerade in Lüneburg! Die Plattform kann noch Fehler haben und wird beständig verbessert. 
			Wenn du uns dabei unterstützen magst, frag uns gerne nach einem Zugang, nutze die Plattform und teile uns dein Feedback mit!
			<a
				href="mailto:feedback@allerleih.org?subject=Beta-Zugang%20AllerLeih&body=Hallo%20AllerLeih-Team%2C%0A%0Aich%20möchte%20gerne%20einen%20Beta-Zugang%20für%20AllerLeih%20beantragen."
				class="text-accent hover:underline flex items-center font-medium mt-1"
			>
				E-Mail an feedback@allerleih.org
				<ChevronRightOutline class="text-accent h-4 w-4" />
			</a>
		</div>
	</Popover>