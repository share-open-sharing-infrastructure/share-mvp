<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Label, Input } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import debounce from 'debounce';
	import PocketBase from 'pocketbase';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import LegalDocModal from '$lib/components/LegalDocModal.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { USERNAME_MAX_LENGTH, normalizeUsername, validateUsername } from '$lib/utils/username';

	let { data, form } = $props();

	// Legal docs shown inline in a modal (not a new tab — unusable in the PWA).
	const tosDoc = $derived(data.legalDocs?.find((d) => d.docType === 'tos'));
	const privacyDoc = $derived(data.legalDocs?.find((d) => d.docType === 'privacy'));
	let openTos = $state(false);
	let openPrivacy = $state(false);

	const pb = new PocketBase(PUBLIC_PB_URL);

	let username = $state('');
	let usernameStatus: 'idle' | 'checking' | 'available' | 'taken' | 'too_short' | 'too_long' | 'invalid' =
		$state('idle');
	const checkUsername = debounce(async (value: string) => {
		try {
			await pb.collection('users_public').getFirstListItem(pb.filter('username = {:username}', { username: value }));
			usernameStatus = 'taken';
		} catch {
			usernameStatus = 'available';
		}
	}, 500);

	$effect(() => {
		const value = normalizeUsername(username);
		if (value === '') {
			checkUsername.clear();
			usernameStatus = 'idle';
			return;
		}
		const validity = validateUsername(value);
		if (validity !== 'ok') {
			checkUsername.clear();
			usernameStatus = validity;
			return;
		}
		usernameStatus = 'checking';
		checkUsername(value);
	});
</script>

<SeoHead
	title={texts.seo.register.title}
	description={texts.seo.register.description}
	robots="noindex"
/>

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
					<span>{texts.forms.email}</span>
					<Input
						type="email"
						name="email"
						placeholder={texts.auth.emailPlaceholder}
						class="focus:border-primary-700 focus:ring-primary-700"
						autocomplete="email"
						autocapitalize="none"
						autocorrect="off"
						spellcheck="false"
						required
					/>
				</Label>
				<PasswordInput autocomplete="new-password" />
				<Label class="space-y-2">
					<span>{texts.forms.username}</span>
					<Input
						type="text"
						name="username"
						placeholder={texts.auth.usernamePlaceholder}
						class="focus:border-primary-700 focus:ring-primary-700"
						bind:value={username}
						required
						maxlength={USERNAME_MAX_LENGTH}
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
					{:else if usernameStatus === 'too_short'}
						<p class="text-sm text-accent-600 dark:text-accent-400">{texts.errors.usernameTooShort}</p>
					{:else if usernameStatus === 'too_long'}
						<p class="text-sm text-accent-600 dark:text-accent-400">{texts.errors.usernameTooLong}</p>
					{:else if usernameStatus === 'invalid'}
						<p class="text-sm text-accent-600 dark:text-accent-400">{texts.errors.usernameInvalidFormat}</p>
					{/if}
					<p class="text-sm text-tinte-500 dark:text-tinte-400">{texts.auth.usernameHint}</p>
				</Label>
				<label class="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-300">
					<input type="checkbox" name="userConsent" required class="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
					<span>Ich habe die <Button variant="link" onclick={(e) => { e.preventDefault(); e.stopPropagation(); openTos = true; }}>AGB{tosDoc ? ` (v${tosDoc.version})` : ''}</Button> und die <Button variant="link" onclick={(e) => { e.preventDefault(); e.stopPropagation(); openPrivacy = true; }}>Datenschutzerklärung{privacyDoc ? ` (v${privacyDoc.version})` : ''}</Button> gelesen und stimme beiden zu.</span>
				</label>
				<label class="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-300">
					<input type="checkbox" name="subscribeToNewsletter" checked class="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
					<span>{texts.auth.newsletterOptOut}</span>
				</label>
				<Button type="submit">{texts.auth.register}</Button>
			</form>
		</div>
	</Register>
</Section>

<!-- Document modals live OUTSIDE the form above: Flowbite's modal close (×) is a
     <button> that would otherwise submit the registration form (review on PR #440). -->
{#if tosDoc}
	<LegalDocModal bind:open={openTos} title={tosDoc.title} version={tosDoc.version} effectiveDate={tosDoc.effectiveDate} body={tosDoc.body} />
{/if}
{#if privacyDoc}
	<LegalDocModal bind:open={openPrivacy} title={privacyDoc.title} version={privacyDoc.version} effectiveDate={privacyDoc.effectiveDate} body={privacyDoc.body} />
{/if}
