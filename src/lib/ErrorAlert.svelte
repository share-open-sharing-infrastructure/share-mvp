<script>
	import { Alert } from 'flowbite-svelte';
	import { InfoCircleSolid } from 'flowbite-svelte-icons';
	import { fly } from 'svelte/transition';
	export let errorMessage = '';
</script>

{#if errorMessage}
	<Alert
		class="mt-5"
		color="red"
		dismissable
		transition={fly}
		params={{ x: 200 }}
	>
		{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
		<span class="font-medium">{errorMessage}</span>
	</Alert>
{/if}
