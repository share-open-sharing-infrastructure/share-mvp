<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Checkbox, Label, Input } from 'flowbite-svelte';
	export let form: ActionData;
	import { Alert } from 'flowbite-svelte';
</script>

<Section name="register">
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
			Registrieren
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<form class="flex flex-col space-y-5" action="?/login" method="post">
				<h3 class="p-0 text-xl font-medium text-gray-900 dark:text-white">Wilkommen bei Share</h3>
				<Label class="space-y-2">
					<span>Deine E-Mail Adresse</span>
					<Input type="email" name="email" placeholder="E-Mail Adresse" class="focus:ring-gray-700 focus:border-gray-700" required />
				</Label>
				<Label class="space-y-2">
					<span>Dein Passwort</span>
					<Input type="password" name="password" placeholder="••••••••••" class="focus:ring-gray-700 focus:border-gray-700" required />
				</Label>
				<Button
					type="submit"
					formaction="?/register"
					class="me-2 mb-2 w-full rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
					>Registrieren</Button
				>
			</form>
		</div>
	</Register>
</Section>
