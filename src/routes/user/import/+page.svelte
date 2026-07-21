<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Badge } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import AllerLoader from '$lib/components/AllerLoader.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';

	let { form } = $props();

	type Step = 'upload' | 'preview' | 'done';
	let step = $state<Step>('upload');
	let fileError = $state('');
	let selectedFile = $state<File | null>(null);
	let submitting = $state(false);

	$effect(() => {
		if (form?.preview) step = 'preview';
		if (form?.done) step = 'done';
		if (form?.error) step = 'upload';
	});

	function handleFileChange(e: Event) {
		fileError = '';
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		if (!file) { selectedFile = null; return; }
		if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
			fileError = texts.institutional.importXlsxError;
			input.value = '';
			selectedFile = null;
			return;
		}
		selectedFile = file;
	}

	const actionBadgeColor = (action: string) => {
		if (action === 'create') return 'green';
		if (action === 'update') return 'blue';
		if (action === 'archive') return 'yellow';
		if (action === 'error') return 'red';
		return 'gray';
	};

	const actionLabel = (action: string) => texts.institutional.importActionLabels[action] ?? action;
</script>

<SeoHead title={texts.seo.userImport.title} robots="noindex, nofollow" />

<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center mb-6">
		<h2 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">
			{texts.institutional.importTitle}
		</h2>
	</div>
</div>

<form method="POST" action="?/refresh" 
	use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }} 
	class="px-4 mx-auto max-w-7xl justify-center flex">	
	<Button type="submit">{texts.institutional.importRefreshButton}</Button>
</form>

{#if form?.refreshed}
	<div class="px-4 mx-auto max-w-7xl mt-4 flex justify-center">
		<CustomAlert type="success" message={form.message ?? texts.institutional.importRefreshTriggered} />
	</div>
{/if}

<main class="max-w-3xl mx-auto px-4 py-8 space-y-6 relative">
	{#if submitting}
		<div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-sand/80 rounded-lg gap-3">
			<AllerLoader size={64} variant="rotate" label={texts.institutional.importLoaderLabel} />
			<p class="text-sm text-tinte-600">{texts.institutional.importLoaderHint}</p>
		</div>
	{/if}
	{#if step === 'upload'}
		<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm p-6 space-y-4">
			<p class="text-sm text-tinte-600 dark:text-tinte-400">
				{texts.institutional.importIntro}
			</p>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href="/templates/items-import-template.csv"
				download
				class="inline-flex items-center text-sm font-medium text-primary hover:underline"
			>
				{texts.institutional.importTemplateLink} ↓
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->

			{#if form?.error || fileError}
				<CustomAlert type="error" message={form?.message ?? fileError} />
			{/if}

			<form method="POST" action="?/preview" enctype="multipart/form-data" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }}>
				<div class="space-y-4">
					<div>
						<label for="csv" class="block text-sm font-medium text-tinte-900 mb-1">
							{texts.institutional.importUploadLabel}
						</label>
						<input
							type="file"
							name="csv"
							id="csv"
							accept=".csv"
							onchange={handleFileChange}
							class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
							required
						/>
						<p class="text-xs text-tinte-400 mt-1">{texts.institutional.importUploadHint}</p>
					</div>
					<div class="flex justify-end">
						<Button type="submit" disabled={!selectedFile}>
							{texts.institutional.importPreviewButton}
						</Button>
					</div>
				</div>
			</form>
		</div>

	{:else if step === 'preview' && form?.preview}
		<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm p-6 space-y-4">
			<!-- Summary -->
			<div class="rounded-lg bg-tinte-50 border border-tinte-200 px-4 py-3 text-sm font-medium text-tinte-700">
				{texts.institutional.importPreviewSummary(form.summary)}
			</div>

			{#if form.summary.errors > 0}
				<Alert color="yellow">
					{texts.institutional.importRowErrorsAlert(form.summary.errors)}
				</Alert>
			{/if}

			<!-- Row preview table -->
			{#if form.rowResults && form.rowResults.length > 0}
				<div class="overflow-x-auto">
					<table class="w-full text-sm text-left">
						<thead class="text-xs text-tinte-500 uppercase bg-tinte-50">
							<tr>
								<th class="px-3 py-2">{texts.institutional.importTableHeaders.row}</th>
								<th class="px-3 py-2">{texts.institutional.importTableHeaders.id}</th>
								<th class="px-3 py-2">{texts.institutional.importTableHeaders.name}</th>
								<th class="px-3 py-2">{texts.institutional.importTableHeaders.action}</th>
								<th class="px-3 py-2">{texts.institutional.importTableHeaders.hints}</th>
							</tr>
						</thead>
						<tbody>
							{#each form.rowResults as row (row.rowIndex)}
								<tr class="border-t border-tinte-100">
									<td class="px-3 py-2 text-tinte-400">{row.rowIndex}</td>
									<td class="px-3 py-2 font-mono text-xs truncate max-w-24">{row.externalId}</td>
									<td class="px-3 py-2 truncate max-w-48">{row.name}</td>
									<td class="px-3 py-2">
										<Badge color={actionBadgeColor(row.action)}>{actionLabel(row.action)}</Badge>
									</td>
									<td class="px-3 py-2 text-xs text-accent-600">
										{row.errors.join(' · ')}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if form.totalRows > 50}
						<p class="text-xs text-tinte-400 mt-2">
							{texts.institutional.importPreviewTruncated(form.totalRows)}
						</p>
					{/if}
				</div>
			{/if}

			<!-- Archive preview -->
			{#if form.archiveRows && form.archiveRows.length > 0}
				<div class="space-y-1">
					<p class="text-sm font-medium text-tinte-700">
						{texts.institutional.importArchiveListTitle}
					</p>
					<ul class="text-sm text-tinte-500 list-disc list-inside space-y-0.5">
						{#each form.archiveRows.slice(0, 10) as row (row.id)}
							<li>{row.name} <span class="font-mono text-xs">({row.externalId})</span></li>
						{/each}
						{#if form.archiveRows.length > 10}
							<li class="text-tinte-400">{texts.institutional.importArchiveMore(form.archiveRows.length - 10)}</li>
						{/if}
					</ul>
				</div>
			{/if}

			<!-- Apply form -->
			<form method="POST" action="?/apply" use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }} class="flex gap-3 justify-end">
				<input type="hidden" name="csvText" value={form.csvText} />
				<Button variant="secondary" onclick={() => { step = 'upload'; }}>
					{texts.institutional.importBackButton}
				</Button>
				<Button
					type="submit"
					disabled={form.summary.create === 0 && form.summary.update === 0 && form.summary.archive === 0}
				>
					{texts.institutional.importApplyButton}
				</Button>
			</form>
		</div>

	{:else if step === 'done' && form?.done}
		<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm p-6 space-y-4">
			<h3 class="text-lg font-semibold text-tinte-900">{texts.institutional.importDoneTitle}</h3>
			<div class="rounded-lg bg-tinte-50 border border-tinte-200 px-4 py-3 text-sm font-medium text-tinte-700">
				{texts.institutional.importApplySummary(form.summary)}
			</div>
			{#if form.summary.errors > 0}
				<Alert color="yellow">
					{texts.institutional.importApplyErrorsAlert(form.summary.errors)}
				</Alert>
				{#if form.rowErrors && form.rowErrors.length > 0}
					<ul class="text-xs text-accent-700 font-mono space-y-0.5 list-disc list-inside">
						{#each form.rowErrors as e, i (i)}
							<li>{e}</li>
						{/each}
					</ul>
				{/if}
			{/if}
			<div class="flex gap-3">
				<Button onclick={() => { step = 'upload'; }}>
					{texts.institutional.importAnotherButton}
				</Button>
				<a href={resolve('/user/items')} class="inline-flex items-center text-sm font-medium text-primary hover:underline">
					{texts.institutional.importGoToItems}
				</a>
			</div>
		</div>
	{/if}
</main>
