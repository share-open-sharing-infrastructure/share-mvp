<script lang="ts">
	import { texts } from '$lib/texts';
	import { Accordion, AccordionItem } from 'flowbite-svelte';
	import {
		SearchOutline,
		MessageDotsOutline,
		UsersGroupOutline,
		RefreshOutline,
		UploadOutline,
		InboxOutline,
		ShieldCheckOutline,
		CheckCircleOutline,
	} from 'flowbite-svelte-icons';

	const { guide } = texts.pages;

	const borrowingIcons = [SearchOutline, MessageDotsOutline, UsersGroupOutline, RefreshOutline];
	const lendingIcons = [UploadOutline, InboxOutline, ShieldCheckOutline, CheckCircleOutline];
</script>

<svelte:head>
	<title>{texts.seo.guide.title}</title>
	<meta name="description" content={texts.seo.guide.description} />
	<meta property="og:title" content={texts.seo.guide.title} />
	<meta property="og:description" content={texts.seo.guide.description} />
	<meta property="og:type" content="website" />
	<link rel="canonical" href="https://allerleih.org/misc/guide" />
</svelte:head>

<h1 class="mb-3 text-2xl font-bold">{guide.title}</h1>
<p class="mb-8 text-gray-600">{guide.intro}</p>

<div class="grid gap-6 md:grid-cols-2 ">
	<!-- Borrow -->
	<section class="overflow-hidden bg-primary-50 rounded-2xl border border-gray-200">
		<div class="bg-primary-200 px-8 py-4">
			<h2 class="text-xl font-semibold text-center">{guide.borrowing.title}</h2>
		</div>
		<ol class="space-y-6 p-8">
			{#each guide.borrowing.steps as step, i (i)}
				<li>
					<p class="flex items-center gap-2 font-semibold leading-snug">
						<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-400 text-xs font-bold text-white">{i + 1}</span>{step.label}
					</p>
					<p class="mt-1 text-sm leading-relaxed text-gray-600">{step.text}</p>
				</li>
			{/each}
		</ol>
	</section>

	<!-- Lend -->
	<section class="overflow-hidden bg-accent-50 rounded-2xl border border-gray-200">
		<div class="bg-accent-200 px-8 py-4">
			<h2 class="text-xl font-semibold text-center">{guide.lending.title}</h2>
		</div>
		<ol class="space-y-6 p-8">
			{#each guide.lending.steps as step, i (i)}
				<!-- {@const Icon = lendingIcons[i]} -->
				<li>
					<p class="flex items-center gap-2 font-semibold leading-snug">
						<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-400 text-xs font-bold text-white">{i + 1}</span>{step.label}
						<!-- <Icon class="h-5 w-5 shrink-0 text-accent" /> -->
					</p>
					<p class="mt-1 text-sm leading-relaxed text-gray-600">{step.text}</p>
				</li>
			{/each}
		</ol>
	</section>
</div>

<hr class="my-10 border-gray-200" />

<h2 class="mb-6 text-2xl font-semibold ">{guide.faqTitle}</h2>
<Accordion class="bg-white" activeClass="bg-secondary-100">
	{#each guide.faqItems as item (item.q)}
		<AccordionItem>
			{#snippet header()}{item.q}{/snippet}
			<p class="text-gray-500 dark:text-gray-400">{item.a}</p>
		</AccordionItem>
	{/each}
</Accordion>
