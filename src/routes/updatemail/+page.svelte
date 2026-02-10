<script lang="ts">
	import type { ActionData } from './$types';
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input } from 'flowbite-svelte';
	export let form: ActionData;
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import { texts } from '$lib/texts';
	import { resolve } from '$app/paths';

	let newEmail = '';
</script>

<Section name="reset">
	<Register href={resolve('/')} class="w-md">
		{#snippet top()}
		{texts.pages.updatemail.title}
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			{#if form}
				<CustomAlert type={form.success ? 'success' : 'error'} message={form.message} duration={10000} />
			{/if}

			<form class="flex flex-col space-y-5" action="?/updatemail" method="post">
				<Label class="space-y-2">
					<span>{texts.pages.updatemail.newEmailLabel}</span>
					<Input
						type="email"
						name="newEmail"
						bind:value={newEmail}
						placeholder={texts.forms.email}
						class="focus:border-primary-700 focus:ring-primary-700"
						required
					/>
				</Label>
				<Button
					type="submit"
					formaction="?/updatemail"
					class="me-2 mb-2 w-full rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 focus:outline-none dark:border-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800 dark:focus:ring-primary-700"
					>{texts.pages.updatemail.updateButton}</Button
				>
			</form>
		</div>
	</Register>
</Section>
