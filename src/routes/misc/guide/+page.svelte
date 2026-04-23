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

<h1 class="mb-3 text-2xl font-bold">{guide.title}</h1>
<p class="mb-8 text-gray-600">{guide.intro}</p>

<div class="grid gap-6 md:grid-cols-2">
	<!-- Borrow -->
	<section class="overflow-hidden rounded-2xl border border-gray-200">
		<div class="bg-primary-50 px-8 py-4">
			<h2 class="text-xl font-semibold">{guide.borrowing.title}</h2>
		</div>
		<ol class="space-y-6 p-8">
			{#each guide.borrowing.steps as step, i (i)}
				{@const Icon = borrowingIcons[i]}
				<li>
					<p class="flex items-center justify-center gap-2 font-semibold leading-snug">
						<Icon class="h-5 w-5 shrink-0 text-accent" />{step.label}
					</p>
					<p class="mt-1 text-sm leading-relaxed text-gray-600">{step.text}</p>
				</li>
			{/each}
		</ol>
	</section>

	<!-- Lend -->
	<section class="overflow-hidden rounded-2xl border border-gray-200">
		<div class="bg-accent-100 px-8 py-4">
			<h2 class="text-xl font-semibold">{guide.lending.title}</h2>
		</div>
		<ol class="space-y-6 p-8">
			{#each guide.lending.steps as step, i (i)}
				{@const Icon = lendingIcons[i]}
				<li>
					<p class="flex items-center justify-center gap-2 font-semibold leading-snug">
						<Icon class="h-5 w-5 shrink-0 text-accent" />{step.label}
					</p>
					<p class="mt-1 text-sm leading-relaxed text-gray-600">{step.text}</p>
				</li>
			{/each}
		</ol>
	</section>
</div>

<hr class="my-10 border-gray-200" />

<h2 class="mb-6 text-xl font-semibold">{guide.faqTitle}</h2>
<Accordion>
	{#each guide.faqItems as item (item.q)}
		<AccordionItem>
			{#snippet header()}{item.q}{/snippet}
			<p class="text-gray-500 dark:text-gray-400">{item.a}</p>
		</AccordionItem>
	{/each}
</Accordion>
