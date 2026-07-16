<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, A } from 'flowbite-svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<SeoHead
	title={texts.seo.confirmEmailChange.title}
	description={texts.seo.confirmEmailChange.description}
	robots="noindex"
/>

<Section name="reset">
	{#if form?.fail}
		<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
			<CustomAlert type="error" message={form?.message} />
		</div>
	{/if}

	<Register href={resolve('/')} class="w-full sm:max-w-md">
		{#snippet top()}
			{texts.pages.confirmEmailChange.title}
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			{#if data.token}
				<!-- Keep ?token in the action target so a failed submit re-renders with data.token
				     still set — otherwise the query is replaced by ?/confirm, data.token becomes null,
				     and the {:else} "no token" alert would show ON TOP of the form.fail alert. -->
				<form class="flex flex-col space-y-5" action="?/confirm&token={data.token}" method="post">
					<input type="hidden" name="token" value={data.token} />
					<PasswordInput
						name="password"
						label={texts.pages.confirmEmailChange.passwordLabel}
						autocomplete="current-password"
					/>
					<Button
						type="submit"
						class="min-button bg-primary-200 hover:bg-primary cursor-pointer w-full"
						>{texts.pages.confirmEmailChange.submitButton}</Button
					>
				</form>
			{:else}
				<CustomAlert type="error" message={texts.errors.invalidOrExpiredEmailChangeToken} />
				<A href={resolve('/auth/login')} class="block text-center"
					>{texts.pages.confirmEmailChange.backToLogin}</A
				>
			{/if}
		</div>
	</Register>
</Section>
