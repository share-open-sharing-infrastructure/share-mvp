<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import debounce from 'debounce';
	import PocketBase from 'pocketbase';
	import { PUBLIC_PB_URL } from '$env/static/public';

	let { data, form } = $props();

	const pb = new PocketBase(PUBLIC_PB_URL);

	let username = $state('');
	let usernameStatus: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' = $state('idle');

	const checkUsername = debounce(async (value: string) => {
		try {
			await pb.collection('users').getFirstListItem(`username = "${value}"`);
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
			{#if !data.inviteCode}
				<p class="text-gray-700 dark:text-gray-300">{texts.pages.invite.noInvite}</p>
			{:else}
				<form class="flex flex-col space-y-5" action="?/register" method="post" use:enhance>
					<h3 class="p-0 text-xl font-medium text-gray-900 dark:text-white">
						{texts.ui.welcome}
					</h3>
					{#if data.inviter}
						<p class="text-sm text-green-700 dark:text-green-400">
							{texts.pages.invite.welcomeMessage(data.inviter.username)}
						</p>
					{/if}
					<input type="hidden" name="inviteCode" value={data.inviteCode} />
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
						/>
						{#if usernameStatus === 'checking'}
							<p class="text-sm text-gray-500">...</p>
						{:else if usernameStatus === 'available'}
							<p class="text-sm text-green-600 dark:text-green-400">{texts.success.usernameAvailable}</p>
						{:else if usernameStatus === 'taken'}
							<p class="text-sm text-red-600 dark:text-red-400">{texts.errors.usernameTaken}</p>
						{:else if usernameStatus === 'invalid'}
							<p class="text-sm text-red-600 dark:text-red-400">{texts.errors.usernameNoSpaces}</p>
						{/if}
					</Label>
					<Label class="space-y-2">
						<span>{texts.forms.email}</span>
						<Input
							type="email"
							name="email"
							placeholder={texts.auth.emailPlaceholder}
							class="focus:border-primary-700 focus:ring-primary-700"
							required
						/>
					</Label>
					<Label class="space-y-2">
						<span>{texts.forms.password}</span>
						<Input
							type="password"
							name="password"
							placeholder={texts.auth.passwordPlaceholder}
							class="focus:border-primary-700 focus:ring-primary-700"
							required
						/>
					</Label>
					<Button type="submit" class="min-button bg-primary cursor-pointer"
						>{texts.auth.register}</Button
					>
				</form>
			{/if}
		</div>
	</Register>
</Section>
