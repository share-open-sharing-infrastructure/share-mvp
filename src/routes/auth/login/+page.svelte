<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input } from 'flowbite-svelte';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';

	let { form, data } = $props();
</script>

<Section name="login">
	<Register class="w-full sm:max-w-md">
		{#snippet top()}
			Einloggen
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<form class="flex flex-col space-y-5" action="?/login" method="post">
				<input type="hidden" name="redirectTo" value={data.redirectTo ?? ''} />
				<h3 class="p-0 text-xl font-medium text-accent-900 dark:text-white">
					{texts.ui.welcomeBack}
				</h3>
				{#if form?.fail}
					<CustomAlert
						type="error"
						message={form?.message + ' ' + texts.auth.loginFailed}
					/>
				{/if}
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

				<Button
					type="submit"
					class="
						me-2 mb-2 w-full
						min-button 
						bg-primary
						cursor-pointer

						">{texts.auth.loginButton}</Button
				>
				<p class="mt-2 text-sm font-light text-tinte-500 dark:text-tinte-400">
					<a
						href={resolve('/auth/reset')}
						class="font-medium text-primary-800 hover:underline dark:text-primary-300"
						>{texts.auth.forgotPassword}</a
					>
				</p>

				<p class="mt-4 text-sm font-light text-tinte-500 dark:text-tinte-400">
					Du hast noch keinen Account?
					<a
						href={resolve('/auth/register')}
						class="font-medium text-primary hover:underline dark:text-primary-300"
						>{texts.auth.registerLink}</a
					>
				</p>
			</form>
		</div>
	</Register>
</Section>
