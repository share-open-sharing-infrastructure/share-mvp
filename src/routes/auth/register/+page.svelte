<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import debounce from 'debounce';
	import PocketBase from 'pocketbase';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import LegalDocModal from '$lib/components/LegalDocModal.svelte';

	let { data, form } = $props();

	// Legal docs shown inline in a modal (not a new tab — unusable in the PWA).
	const tosDoc = $derived(data.legalDocs?.find((d) => d.docType === 'tos'));
	const privacyDoc = $derived(data.legalDocs?.find((d) => d.docType === 'privacy'));
	let openTos = $state(false);
	let openPrivacy = $state(false);

	const pb = new PocketBase(PUBLIC_PB_URL);

	let username = $state('');
	let usernameStatus: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' = $state('idle');
	const checkUsername = debounce(async (value: string) => {
		try {
			await pb.collection('users_public').getFirstListItem(pb.filter('username = {:username}', { username: value }));
			usernameStatus = 'taken';
		} catch {
			usernameStatus = 'available';
		}
	}, 500);

	$effect(() => {
		const value = username.trim();
		if (value === '') {
			checkUsername.clear();
			usernameStatus = 'idle';
			return;
		}
		if (value.includes(' ')) {
			checkUsername.clear();
			usernameStatus = 'invalid';
			return;
		}
		usernameStatus = 'checking';
		checkUsername(value);
	});
</script>

<svelte:head>
	<title>{texts.seo.register.title}</title>
	<meta name="description" content={texts.seo.register.description} />
	<meta property="og:title" content={texts.seo.register.title} />
	<meta property="og:description" content={texts.seo.register.description} />
	<meta name="robots" content="noindex" />
</svelte:head>

<Section name="register">
	{#if form?.fail}
		<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
			<CustomAlert type="error" message={form?.message} />
		</div>
	{/if}
	<Register href="/" class="w-full sm:max-w-md">
		<!-- TODO: Why is this a snippet? -->
		{#snippet top()}
			{texts.pages.register.title}
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<form class="flex flex-col space-y-5" action="?/register" method="post" use:enhance>
				<h3 class="p-0 text-xl font-medium text-tinte-900 dark:text-white">
					{texts.ui.welcome}
				</h3>
				{#if data.inviter}
					<p class="text-sm text-green-700 dark:text-green-400">
						{texts.pages.invite.welcomeMessage(data.inviter.username)}
					</p>
				{/if}
				{#if data.inviteCode}
					<input type="hidden" name="inviteCode" value={data.inviteCode} />
				{/if}
				<Label class="space-y-2">
					<span>{texts.forms.username}</span>
					<Input
						type="text"
						name="username"
						placeholder={texts.auth.usernamePlaceholder}
						class="focus:border-primary-700 focus:ring-primary-700"
						bind:value={username}
						required
						autocomplete="username"
						autocorrect="off"
						autocapitalize="off"
						spellcheck={false}
					/>
					{#if usernameStatus === 'checking'}
						<p class="text-sm text-tinte-500">...</p>
					{:else if usernameStatus === 'available'}
						<p class="text-sm text-green-600 dark:text-green-400">{texts.success.usernameAvailable}</p>
					{:else if usernameStatus === 'taken'}
						<p class="text-sm text-accent-600 dark:text-accent-400">{texts.errors.usernameTaken}</p>
					{:else if usernameStatus === 'invalid'}
						<p class="text-sm text-accent-600 dark:text-accent-400">{texts.errors.usernameNoSpaces}</p>
					{/if}
				</Label>
				<Label class="space-y-2">
					<span>{texts.forms.email}</span>
					<Input
						type="email"
						name="email"
						placeholder={texts.auth.emailPlaceholder}
						class="focus:border-primary-700 focus:ring-primary-700"
						autocomplete="email"
						required
					/>
				</Label>
				<PasswordInput autocomplete="new-password" />
				<label class="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-300">
					<input type="checkbox" name="userConsent" required class="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
					<span>Ich habe die <button type="button" onclick={(e) => { e.preventDefault(); e.stopPropagation(); openTos = true; }} class="cursor-pointer text-primary hover:underline">AGB{tosDoc ? ` (v${tosDoc.version})` : ''}</button> und die <button type="button" onclick={(e) => { e.preventDefault(); e.stopPropagation(); openPrivacy = true; }} class="cursor-pointer text-primary hover:underline">Datenschutzerklärung{privacyDoc ? ` (v${privacyDoc.version})` : ''}</button> gelesen und stimme beiden zu.</span>
				</label>
				{#if tosDoc}
					<LegalDocModal bind:open={openTos} title={tosDoc.title} version={tosDoc.version} effectiveDate={tosDoc.effectiveDate} body={tosDoc.body} />
				{/if}
				{#if privacyDoc}
					<LegalDocModal bind:open={openPrivacy} title={privacyDoc.title} version={privacyDoc.version} effectiveDate={privacyDoc.effectiveDate} body={privacyDoc.body} />
				{/if}
				<label class="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-300">
					<input type="checkbox" name="subscribeToNewsletter" checked class="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
					<span>{texts.auth.newsletterOptOut}</span>
				</label>
				<Button type="submit" class="min-button bg-primary-200 hover:bg-primary cursor-pointer"
					>{texts.auth.register}</Button
				>
			</form>
		</div>
	</Register>
</Section>
