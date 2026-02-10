<script lang="ts">
	import { Alert } from 'flowbite-svelte';
	import { InfoCircleSolid } from 'flowbite-svelte-icons';
	import { fly } from 'svelte/transition';
	let { type = 'warn', message, duration = 3000 } = $props();

	let open = $state(true);
	// svelte-ignore state_referenced_locally
	const timer = setTimeout(() => {
		open = false;
	}, duration);

	// clean up on destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => clearTimeout(timer));

	// Type can be success, warn or error - standard is warn
	let color: 'green' | 'yellow' | 'red' = $state('yellow');
	if (type === 'success') {
		color = 'green';
	} else if (type === 'error') {
		color = 'red';
	}
</script>

{#if open}
	<Alert
		alertStatus={open}
		class="mt-5"
		{color}
		dismissable
		transition={fly}
		params={{ x: 200 }}
	>
		{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
		<span class="font-medium">{message}</span>
	</Alert>
{/if}
