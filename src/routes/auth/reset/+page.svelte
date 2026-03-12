<script lang="ts">
	import type { ActionData } from './$types';
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input } from 'flowbite-svelte';
	export let form: ActionData;
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
</script>

<Section name="reset">
	{#if form?.fail}
		<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
			<CustomAlert type="error" message={form?.message} />
		</div>
	{/if}

	<Register href={resolve('/')} class="w-full sm:max-w-md">
		{#snippet top()}
			{texts.pages.reset.title}
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<form class="flex flex-col space-y-5" action="?/login" method="post">
				<Label class="space-y-2">
					<span>{texts.pages.reset.emailLabel}</span>
					<Input
						type="email"
						name="email"
						placeholder={texts.forms.email}
						class="focus:border-primary-700 focus:ring-primary-700"
						required
					/>
				</Label>
				<Button
					type="submit"
					formaction="?/reset"
					class="min-button bg-primary cursor-pointer w-full"
					>{texts.pages.reset.resetButton}</Button
				>
			</form>
		</div>
	</Register>
</Section>
