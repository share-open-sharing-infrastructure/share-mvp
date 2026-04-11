<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	import { ChartPieSolid } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';

	import landingimg from '$lib/images/landing-img.png';
</script>

<section class="bg-white dark:bg-gray-900">
	<div
		class="grid max-w-7xl px-8 py-8 mx-auto lg:gap-8 xl:gap-0 lg:py-16 lg:grid-cols-12"
	>
		<div class="mr-auto place-self-center mt-15 col-span-12 xl:col-span-7">
			<h1
				class="max-w-2xl mb-4 text-4xl font-extrabold tracking-tight leading-none md:text-5xl xl:text-6xl dark:text-white"
			>
				Willkommen bei {texts.names.app}
			</h1>
			<p
				class="max-w-2xl mb-6 font-light text-gray-500 lg:mb-8 md:text-lg lg:text-xl dark:text-gray-400"
			>
				{texts.pages.landing.tagline}
				<span class="text-accent">{texts.pages.landing.city}</span>
			</p>

			<Button href="/search" class="cta-button text-lg py-4 px-6 sm:px-10 m-3 bg-primary w-full md:w-xs">
				{texts.pages.landing.ctaButtonSearch}
			</Button>
			<Button
				href="/user/items"
				class="cta-button text-lg py-4 m-3 px-6 sm:px-10 bg-accent w-full md:w-xs"
			>
				{texts.pages.landing.ctaButtonUpload}
			</Button>
		</div>
		<div class="hidden xl:mt-0 xl:col-span-5 xl:flex landing-img">
			<img src={landingimg} alt="landing-png" />
		</div>
	</div>
</section>

<section class="bg-white dark:bg-gray-900 antialiased">
	<div class="max-w-7xl px-4 py-8 mx-auto lg:px-6 sm:py-16 lg:py-24">
		<div
			class="grid grid-cols-1 mt-12 text-center sm:mt-16 gap-x-20 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
		>
			<div class="space-y-4">
				<span
					class="bg-primary-100 text-gray-900 text-md font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-gray-300"
				>
					{texts.pages.landing.how}
				</span>

				<p class="text-lg font-normal text-gray-500 dark:text-gray-400">
					<a href={resolve('/misc/howto')} class="text-accent">Hier</a> geben
					wir dir eine kurze Einführung, wie du {texts.names.app} nutzen kannst, um
					Dinge in deiner Umgebung zu leihen oder zu verleihen.
				</p>
			</div>

			<div class="space-y-4">
				<span
					class="bg-primary-100 text-gray-900 text-md font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-gray-300"
				>
					{texts.pages.landing.who}
				</span>

				<p class="text-lg font-normal text-gray-500 dark:text-gray-400">
					Wir sind noch im Aufbau, aber du kannst uns gerne jederzeit <a
						href={resolve('/misc/contact')}
						class="text-accent">kontaktieren</a
					>, wenn du Fragen hast oder uns unterstützen willst!
				</p>
			</div>

			<div class="space-y-4">
				{#snippet icon()}<ChartPieSolid
						class="text-primary-600 dark:text-primary-300"
					/>{/snippet}
				<span
					class="bg-primary-100 text-gray-900 text-md font-medium inline-flex items-center px-2.5 py-0.5 rounded dark:bg-gray-700 dark:text-gray-300"
				>
					{texts.pages.landing.support}
				</span>

				<p class="text-lg font-normal text-gray-500 dark:text-gray-400">
					Wir befinden uns derzeit in einer Testphase mit einer kleinen Gruppe
					von Nutzer:innen. Wenn du Interesse hast, an diesem Test teilzunehmen, <a
						href={resolve('/misc/contact')}
						class="text-accent">melde dich gerne bei uns</a
					>.
				</p>
			</div>
		</div>
	</div>
</section>
