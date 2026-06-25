<script lang="ts">
	import { texts } from '$lib/texts';
	import { Button, Modal, Input, Label } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CustomAlert from '$lib/components/CustomAlert.svelte';

	let { form } = $props();

	let showDeleteModal = $state(false);
	let confirmText = $state('');
	let password = $state('');
	let isDeleting = $state(false);

	const canDelete = $derived(
		confirmText.trim() === texts.account.delete.confirmPhrase && password.length > 0
	);

	function closeModal() {
		showDeleteModal = false;
		confirmText = '';
		password = '';
	}
</script>

<svelte:head>
	<title>{texts.account.pageTitle}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="bg-secondary-100 dark:bg-tinte-900 min-h-screen">
	<div class="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
		<div class="text-center">
			<h1 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">
				{texts.account.pageTitle}
			</h1>
			<p class="mt-2 text-sm text-tinte-600 dark:text-tinte-400">{texts.account.pageIntro}</p>
		</div>

		<!-- Data export (Art. 15 / 20) -->
		<section class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6">
			<h2 class="text-lg font-semibold text-tinte-900 dark:text-white">{texts.account.export.title}</h2>
			<p class="mt-1 text-sm text-tinte-600 dark:text-tinte-400">{texts.account.export.description}</p>
			<a
				href={resolve('/user/account/export')}
				download
				class="mt-4 inline-flex items-center justify-center py-2.5 px-5 min-button bg-primary-200 hover:bg-primary text-white font-semibold rounded-xl transition-opacity"
			>
				{texts.account.export.button}
			</a>
		</section>

		<!-- Danger zone — account deletion (Art. 17) -->
		<section class="border border-accent-300 dark:border-accent-700 rounded-lg shadow-sm bg-accent-50 dark:bg-accent-900/20 p-6">
			<h2 class="text-lg font-semibold text-accent-800 dark:text-accent-300">{texts.account.delete.title}</h2>
			<p class="mt-1 text-sm text-tinte-700 dark:text-tinte-300">{texts.account.delete.description}</p>
			<p class="mt-2 text-sm font-semibold text-accent-700 dark:text-accent-400">{texts.account.delete.warning}</p>
			<Button
				color="red"
				class="mt-4"
				onclick={() => (showDeleteModal = true)}
			>
				{texts.account.delete.openButton}
			</Button>
		</section>
	</div>
</main>

<Modal title={texts.account.delete.title} bind:open={showDeleteModal} dismissable={false} onclose={closeModal}>
	<form
		method="POST"
		action="?/deleteAccount"
		use:enhance={() => {
			isDeleting = true;
			return async ({ update }) => {
				// keep the typed values on error so the user only fixes the password
				await update({ reset: false });
				isDeleting = false;
			};
		}}
		class="space-y-4"
		autocomplete="off"
	>

		<p class="text-sm text-tinte-700 dark:text-tinte-300">{texts.account.delete.description}</p>

		{#if form?.error}
			<CustomAlert type="error" message={form.message} />
		{/if}

		<div>
			<Label for="confirmText" class="mb-1">{texts.account.delete.confirmPhraseLabel}</Label>
			<Input id="confirmText" name="confirmPhrase" bind:value={confirmText} autocomplete="off" />
		</div>

		<div>
			<Label for="password" class="mb-1">{texts.account.delete.passwordLabel}</Label>
			<Input
				id="password"
				name="password"
				type="password"
				bind:value={password}
				placeholder={texts.account.delete.passwordPlaceholder}
				autocomplete="new-password"
			/>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button color="alternative" type="button" onclick={closeModal}>
				{texts.account.delete.cancelButton}
			</Button>
			<Button color="red" type="submit" disabled={!canDelete || isDeleting}>
				{texts.account.delete.confirmButton}
			</Button>
		</div>
	</form>
</Modal>
