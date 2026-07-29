<script lang="ts">
	import { Label, Input } from 'flowbite-svelte';
	import { EyeOutline, EyeSlashOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		autocomplete = 'current-password',
		name = 'password',
		label = texts.forms.password,
	}: { autocomplete?: AutoFill | null; name?: string; label?: string } = $props();

	let showPassword = $state(false);
</script>

<Label class="space-y-2">
	<span>{label}</span>
	<div class="relative">
		<Input
			type={showPassword ? 'text' : 'password'}
			{name}
			placeholder={texts.auth.passwordPlaceholder}
			class="focus:border-primary-700 focus:ring-primary-700 pr-10"
			{autocomplete}
			required
		/>
		<Button
			variant="ghost"
			size="icon-sm"
			class="absolute right-1 top-1/2 -translate-y-1/2"
			onclick={() => (showPassword = !showPassword)}
			aria-label={showPassword ? texts.auth.hidePassword : texts.auth.showPassword}
		>
			{#if showPassword}
				<EyeSlashOutline class="h-5 w-5" />
			{:else}
				<EyeOutline class="h-5 w-5" />
			{/if}
		</Button>
	</div>
</Label>
