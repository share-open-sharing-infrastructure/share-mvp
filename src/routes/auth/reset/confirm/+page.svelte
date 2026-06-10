<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, A } from 'flowbite-svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<Section name="reset">
	{#if form?.fail}
		<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
			<CustomAlert type="error" message={form?.message} />
		</div>
	{/if}

	<Register href={resolve('/')} class="w-full sm:max-w-md">
		{#snippet top()}
			{texts.pages.reset.confirm.title}
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			{#if data.token}
				<form class="flex flex-col space-y-5" action="?/confirm" method="post">
					<input type="hidden" name="token" value={data.token} />
					<PasswordInput
						name="password"
						label={texts.pages.reset.confirm.newPasswordLabel}
						autocomplete="new-password"
					/>
					<PasswordInput
						name="passwordConfirm"
						label={texts.pages.reset.confirm.confirmPasswordLabel}
						autocomplete="new-password"
					/>
					<Button
						type="submit"
						class="min-button bg-primary-200 hover:bg-primary cursor-pointer w-full"
						>{texts.pages.reset.confirm.submitButton}</Button
					>
				</form>
			{:else}
				<CustomAlert type="error" message={texts.errors.invalidOrExpiredResetToken} />
				<A href={resolve('/auth/reset')} class="block text-center"
					>{texts.pages.reset.confirm.backToReset}</A
				>
			{/if}
		</div>
	</Register>
</Section>
