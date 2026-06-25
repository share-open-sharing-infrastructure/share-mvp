<script lang="ts">
	import { Alert, Button, Checkbox } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import LegalDocModal from '$lib/components/LegalDocModal.svelte';

	const { data, form } = $props();

	// Which document modal is open (read inline — a new tab is unusable in the PWA).
	let openDoc = $state<Record<string, boolean>>(
		Object.fromEntries(data.docs.map((d) => [d.docType, false]))
	);

	// One confirmation flag per outstanding document, keyed by docType. Seed every
	// key up front (to false) so the $derived below tracks them reactively — binding
	// to an initially-absent key of an empty $state object does not reliably trigger
	// the derived, which left the submit button stuck disabled after ticking boxes.
	let confirmed = $state<Record<string, boolean>>(
		Object.fromEntries(data.docs.map((d) => [d.docType, false]))
	);

	const canSubmit = $derived(data.docs.every((d) => confirmed[d.docType] === true));
</script>

<svelte:head>
	<title>{texts.legal.accept.pageTitle}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8 space-y-6">
	<h1 class="text-3xl font-bold tracking-tight text-tinte-900 dark:text-white">
		{texts.legal.accept.pageTitle}
	</h1>

	<p class="text-tinte-700 dark:text-tinte-300">{texts.legal.accept.intro}</p>

	{#if data.fromGate}
		<Alert color="yellow">{texts.legal.accept.gateNotice}</Alert>
	{/if}

	{#if form?.error && form?.message}
		<Alert color="red">{form.message}</Alert>
	{/if}

	<form method="POST" action="?/accept" use:enhance class="space-y-4">
		{#each data.docs as doc (doc.docType)}
			<div
				class="rounded-2xl border border-tinte-200 dark:border-tinte-700 bg-sand dark:bg-tinte-800 p-4 space-y-3"
			>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<span class="font-semibold text-tinte-900 dark:text-white">{doc.name}</span>
					<span class="text-xs text-tinte-500 dark:text-tinte-400">
						Version {doc.version} · {doc.effectiveDate}
					</span>
				</div>
				<button
					type="button"
					onclick={() => (openDoc[doc.docType] = true)}
					class="inline-block cursor-pointer text-sm text-primary hover:underline"
				>
					{texts.legal.accept.reviewLinkLabel} →
				</button>
				<LegalDocModal
					bind:open={openDoc[doc.docType]}
					title={doc.name}
					version={doc.version}
					effectiveDate={doc.effectiveDate}
					body={doc.body}
				/>
				<Checkbox bind:checked={confirmed[doc.docType]} name={`confirm_${doc.docType}`}>
					{texts.legal.accept.checkboxLabel(doc.name, doc.version)}
				</Checkbox>
			</div>
		{/each}

		<Button
			type="submit"
			pill
			disabled={!canSubmit}
			class="cursor-pointer bg-primary font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-tinte-200 disabled:text-tinte-400 dark:disabled:bg-tinte-700 dark:disabled:text-tinte-500"
		>
			{texts.legal.accept.acceptButton}
		</Button>
	</form>

	<!-- Declining locks the account (handled by the backend hook) — kept visually
	     subordinate and separated so it isn't mistaken for the primary action. -->
	<div class="border-t border-tinte-200 dark:border-tinte-700 pt-4 space-y-2">
		<p class="text-sm text-tinte-500 dark:text-tinte-400">{texts.legal.accept.declineHint}</p>
		<form method="POST" action="?/decline" use:enhance>
			<Button
				type="submit"
				color="light"
				size="sm"
				class="cursor-pointer text-tinte-600 dark:text-tinte-300"
			>
				{texts.legal.accept.declineButton}
			</Button>
		</form>
	</div>
</div>
