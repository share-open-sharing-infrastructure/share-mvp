<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input } from 'flowbite-svelte';
	import { Alert } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	let { form } = $props();
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
		<!-- TODO: Why is this a snippet? -->
		{#snippet top()}
			{texts.pages.register.title}
		{/snippet}
		<div class="space-y-4 p-6 sm:p-8 md:space-y-6">
			<!-- TODO: Check if login action is correct -->
			<form class="flex flex-col space-y-5" action="?/login" method="post">
				<h3 class="p-0 text-xl font-medium text-gray-900 dark:text-white">
					{texts.ui.welcome}
				</h3>
				<Label class="space-y-2">
					<span>{texts.forms.email}</span>
					<Input
						type="email"
						name="email"
						placeholder="{texts.auth.emailPlaceholder}"
						class="focus:border-primary-700 focus:ring-primary-700"
						required
					/>
				</Label>
				<Label class="space-y-2">
					<span>{texts.forms.password}</span>
					<Input
						type="password"
						name="password"
						placeholder="{texts.auth.passwordPlaceholder}"
						class="focus:border-primary-700 focus:ring-primary-700"
						required
					/>
				</Label>
				<Label class="space-y-2">
					<span>{texts.forms.secret}</span>
					<Input
						type="text"
						name="secret"
						placeholder="{texts.auth.secretPlaceholder}"
						class="focus:border-primary-700 focus:ring-primary-700"
						required
					/>
				</Label>
				<Button type="submit" formaction="?/register" class="min-button"
					>{texts.auth.register}</Button
				>
			</form>
		</div>
	</Register>
</Section>
