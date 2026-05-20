<script lang="ts">
	import { Alert, Button, Checkbox } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { formatTimestamp } from '$lib/utils/utils';

	const { data, form } = $props();

	let confirmAdult = $state(false);
	let confirmTerms = $state(false);

	const canSubmit = $derived(confirmAdult && confirmTerms);

	const effectiveFromDisplay = $derived(
		data.terms.effectiveFrom ? formatTimestamp(data.terms.effectiveFrom) : ''
	);
</script>

<svelte:head>
	<title>{texts.lendingTerms.pageTitle} – {data.item.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6 space-y-6">
	<a
		href={resolve(`/items/${data.item.id}`)}
		class="inline-block text-sm text-tinte-500 dark:text-tinte-400 hover:text-tinte-700 dark:hover:text-tinte-200"
	>
		← {data.item.name}
	</a>

	<h1 class="text-3xl font-bold tracking-tight text-tinte-900 dark:text-white">
		{data.terms.title}
	</h1>

	<p class="text-tinte-700 dark:text-tinte-300">
		{data.ownerName
			? texts.lendingTerms.introWithOwner(data.ownerName)
			: texts.lendingTerms.introGeneric}
	</p>

	<!-- Verantwortlicher / Plattform-Hinweis -->
	<Alert color="blue" class="text-sm">
		{#if data.terms.contactPerson}
			<p class="mb-1">
				{texts.lendingTerms.responsibleNote(data.terms.contactPerson)}
			</p>
		{/if}
		<p>{texts.lendingTerms.platformOnlyNote}</p>
	</Alert>

	<!-- Versions-Meta -->
	<div class="flex flex-wrap gap-3 text-xs text-tinte-500 dark:text-tinte-400">
		<span class="rounded-full border border-tinte-200 dark:border-tinte-700 px-2 py-0.5">
			{texts.lendingTerms.versionLabel(data.terms.version)}
		</span>
		{#if effectiveFromDisplay}
			<span class="rounded-full border border-tinte-200 dark:border-tinte-700 px-2 py-0.5">
				{texts.lendingTerms.effectiveFromLabel(effectiveFromDisplay)}
			</span>
		{/if}
	</div>

	<!-- Vollständiger Bedingungstext (PocketBase richtext = HTML; bereits server-seitig
	     normalisiert in lendingTerms.cleanTermsHtml). Quelle ist admin-only. -->
	<article
		class="terms-body rounded-2xl border border-tinte-200 dark:border-tinte-700 bg-sand dark:bg-tinte-800 p-6 leading-relaxed text-tinte-800 dark:text-tinte-200"
	>
		{@html data.terms.body}
	</article>

	<!-- Minderjährigen-Hinweis -->
	<div class="rounded-2xl bg-secondary-100 dark:bg-tinte-700 p-4 text-sm text-tinte-800 dark:text-tinte-100">
		<p class="font-semibold">{texts.lendingTerms.minorHintTitle}</p>
		<p class="mt-1">{texts.lendingTerms.minorHintBody}</p>
	</div>

	{#if form?.error && form?.message}
		<Alert color="red">{form.message}</Alert>
	{/if}

	{#if data.alreadyAccepted}
		<Alert color="green">{texts.lendingTerms.alreadyAcceptedNote}</Alert>
	{/if}

	<!-- Zustimmungs-Form -->
	<form method="POST" action="?/accept" use:enhance class="space-y-4">
		<Checkbox bind:checked={confirmAdult} name="confirmAdult">
			{texts.lendingTerms.confirmAdultLabel(data.terms.minAge ?? 18)}
		</Checkbox>

		<Checkbox bind:checked={confirmTerms} name="confirmTerms">
			{texts.lendingTerms.confirmTermsLabel(data.terms.version)}
		</Checkbox>

		<div class="flex flex-wrap gap-3 items-center pt-2">
			<Button
				type="submit"
				pill
				disabled={!canSubmit}
				class="cursor-pointer bg-primary-200 hover:bg-primary disabled:opacity-50"
			>
				{texts.lendingTerms.acceptAndRequestButton}
			</Button>
			<a
				href={resolve(`/items/${data.item.id}`)}
				class="text-sm text-tinte-500 dark:text-tinte-400 hover:text-tinte-700 dark:hover:text-tinte-200"
			>
				{texts.lendingTerms.cancel}
			</a>
		</div>
	</form>
</div>

<style>
	/* Lokale Typografie nur für den Bedingungs-Block — wir wollen nicht von einem
	   globalen `.prose`-Plugin abhängen, und PB liefert eine eher schlichte
	   <div>/<h2>/<a>-Struktur, der wir hier passende Abstände geben. */
	.terms-body :global(h2) {
		font-size: 1.25rem;
		font-weight: 700;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
	}
	.terms-body :global(h3) {
		font-size: 1.1rem;
		font-weight: 600;
		margin-top: 1rem;
		margin-bottom: 0.4rem;
	}
	.terms-body :global(h4) {
		font-size: 1rem;
		font-weight: 600;
		margin-top: 0.8rem;
		margin-bottom: 0.3rem;
	}
	.terms-body :global(div),
	.terms-body :global(p) {
		margin-top: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.terms-body :global(div:first-child),
	.terms-body :global(p:first-child) {
		margin-top: 0;
	}
	.terms-body :global(ul),
	.terms-body :global(ol) {
		margin: 0.5rem 0 0.5rem 1.25rem;
		list-style: disc;
	}
	.terms-body :global(ol) {
		list-style: decimal;
	}
	.terms-body :global(li) {
		margin-bottom: 0.25rem;
	}
	.terms-body :global(a) {
		color: #1d4ed8;
		text-decoration: underline;
	}
	.terms-body :global(strong) {
		font-weight: 700;
	}
	.terms-body :global(em) {
		font-style: italic;
	}
</style>
