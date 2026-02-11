<script lang="ts">
	import { Section, Register } from 'flowbite-svelte-blocks';
	import { Button, Label, Input, Popover } from 'flowbite-svelte';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import { QuestionCircleSolid } from 'flowbite-svelte-icons';
	let { form } = $props();
</script>

<Section name="register">
	{#if form?.fail}
		<div class="variant-soft-error rounded-token mb-2 px-4 py-2">
			<CustomAlert type="error" message={form?.message} />
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
				<Label class="space-y-2">
					<span>{texts.forms.secret}</span>
					<div class="flex items-center gap-2">
						<Input
							type="text"
							name="secret"
							placeholder={texts.auth.secretPlaceholder}
							class="focus:border-primary-700 focus:ring-primary-700"
							required
						/>
						<button
							id="b3"
							type="button"
							class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex-shrink-0"
							aria-label={texts.ui.explainThis}
						>
							<QuestionCircleSolid class="h-5 w-5" />
						</button>
					</div>
				</Label>
				<Button type="submit" formaction="?/register" class="min-button"
					>{texts.auth.register}</Button
				>
			</form>
		</div>
	</Register>
</Section>

<Popover
	triggeredBy="#b3"
	class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
	placement="bottom-start"
>
	<div class="space-y-2 p-3">
		<h3 class="font-semibold text-gray-900 dark:text-white">Beta-Zugang</h3>
		Wenn du einen Beta-Zugang möchtest, schreibe eine Mail an<a
			href="mailto:allerleih@posteo.de?subject=AllerLeih Beta-Zugang&body=Bitte schickt mir einen Beta-Code für AllerLeih"
			class="primary-text hover:underline dark:text-primary-300"
		>
			allerleih@posteo.de
		</a>
	</div>
</Popover>
