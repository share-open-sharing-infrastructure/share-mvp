<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input, Alert } from 'flowbite-svelte';

	let { form } = $props();
</script>

<Section name="login">
	<Register href="/" class="w-md">
		{#snippet top()}
			Einloggen
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<form class="flex flex-col space-y-5" action="?/login" method="post">
				<h3 class="p-0 text-xl font-medium text-gray-900 dark:text-white">Wilkommen zurück!</h3>
				{#if form?.fail}
					<Alert>
						<span class="font-medium">
							{form.message} 
							Sind Nutzername & Passwort korrekt?
						</span>
					</Alert>
				{/if}
				<Label class="space-y-2">
					<span>Deine E-Mail Adresse</span>
					<Input type="email" name="email" placeholder="E-Mail Adresse" class="focus:ring-gray-700 focus:border-gray-700" required />
				</Label>
				<Label class="space-y-2">
					<span>Dein Passwort</span>
					<Input type="password" name="password" placeholder="••••••••••" class="focus:ring-gray-700 focus:border-gray-700" required />
				</Label>

				<p class="mt-2 text-sm font-light text-gray-500 dark:text-gray-400">
					<a href="/reset" class="font-medium text-gray-800 hover:underline dark:text-gray-300"
						>Passwort vergessen?</a
					>
				</p>

				<Button
					type="submit"
					class="me-2 mb-2 w-full rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-900 focus:ring-4 focus:ring-gray-300 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
					>Anmelden</Button
				>
				<p class="mt-4 text-sm font-light text-gray-500 dark:text-gray-400">
					Noch keinen Account?
					<a href="/register" class="font-medium text-gray-800 hover:underline dark:text-gray-300"
						>Registrieren</a
					>
				</p>
			</form>
		</div>
	</Register>
</Section>
