<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';

	let { data, form } = $props();
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
				<form class="flex flex-col space-y-5" action="?/register" method="post">
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
