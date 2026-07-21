<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Label, Input } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';

	let { form, data } = $props();
</script>

<SeoHead
	title={texts.seo.login.title}
	description={texts.seo.login.description}
	canonical="https://allerleih.org/auth/login"
/>

<Section name="login">
	<Register class="w-full sm:max-w-md">
		{#snippet top()}
			Einloggen
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<form class="flex flex-col space-y-5" action="?/login" method="post" use:enhance>
				<input type="hidden" name="redirectTo" value={data.redirectTo ?? ''} />
				<h3 class="p-0 text-xl font-medium text-accent-900 dark:text-white">
					{texts.ui.welcomeBack}
				</h3>
				{#if form?.fail}
					<CustomAlert
						type="error"
						message={form?.message}
					/>
				{/if}
				<Label class="space-y-2">
					<span>{texts.forms.email}</span>
					<Input
						type="email"
						name="email"
						placeholder={texts.auth.emailPlaceholder}
						class="focus:border-primary-700 focus:ring-primary-700"
						autocomplete="email"
						autocapitalize="none"
						autocorrect="off"
						spellcheck="false"
						required
					/>
					<p class="text-sm text-tinte-500 dark:text-tinte-400">{texts.auth.loginWithEmailHint}</p>
				</Label>
				<PasswordInput autocomplete="current-password" />

				<Button type="submit" fullWidth>{texts.auth.loginButton}</Button>
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
