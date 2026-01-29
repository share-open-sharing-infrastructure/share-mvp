<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input } from 'flowbite-svelte';
	export let form: ActionData;
	import { Alert } from 'flowbite-svelte';
</script>

<Section name="reset">
	{#if form?.fail}
		<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
			<Alert>
				<span class="font-medium">
					{form.message}
				</span>
			</Alert>
		</div>
	{/if}

	<Register href="/" class="w-md">
		{#snippet top()}
			Mailadresse ändern
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<form class="flex flex-col space-y-5" action="?/updatemail" method="post">
				<Label class="space-y-2">
					<span>Deine neue E-Mail Adresse:</span>
					<Input
						type="email"
						name="newEmail"
						placeholder="E-Mail Adresse"
						class="focus:border-primary-700 focus:ring-primary-700"
						required
					/>
				</Label>
				<Button
					type="submit"
					formaction="?/updatemail"
					class="me-2 mb-2 w-full rounded-lg bg-primary-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 focus:outline-none dark:border-primary-700 dark:bg-primary-700 dark:hover:bg-primary-800 dark:focus:ring-primary-700"
					>Ändere meine Mailadresse.</Button
				>
			</form>
		</div>
	</Register>
</Section>
