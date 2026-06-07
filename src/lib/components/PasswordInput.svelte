<script lang="ts">
	import { Label, Input } from 'flowbite-svelte';
	import { EyeOutline, EyeSlashOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';

	let { autocomplete = 'current-password' }: { autocomplete?: AutoFill | null } = $props();

	let showPassword = $state(false);
</script>

<Label class="space-y-2">
	<span>{texts.forms.password}</span>
	<div class="relative">
		<Input
			type={showPassword ? 'text' : 'password'}
			name="password"
			placeholder={texts.auth.passwordPlaceholder}
			class="focus:border-primary-700 focus:ring-primary-700 pr-10"
			{autocomplete}
			required
		/>
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex items-center pr-3 text-tinte-500 hover:text-tinte-700 dark:text-tinte-400 dark:hover:text-tinte-200"
			onclick={() => (showPassword = !showPassword)}
			aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
		>
			{#if showPassword}
				<EyeSlashOutline class="h-5 w-5 hover:cursor-pointer" />
			{:else}
				<EyeOutline class="h-5 w-5 hover:cursor-pointer" />
			{/if}
		</button>
	</div>
</Label>
