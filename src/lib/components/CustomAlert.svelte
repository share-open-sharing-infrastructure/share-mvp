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
	// svelte-ignore state_referenced_locally
	if (type === 'success') {
		color = 'green';
	} else if (type === 'error') {
		color = 'red';
	}
</script>

{#if open}
	<div class="my-5">
		<Alert
			alertStatus={open}
			{color}
			dismissable
			transition={fly}
			params={{ x: 200 }}
		>
			{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
			<span class="font-medium">{message}</span>
		</Alert>
		<div
			class="progress-bar"
			class:bg-green-500={color === 'green'}
			class:bg-yellow-500={color === 'yellow'}
			class:bg-red-500={color === 'red'}
			style="--duration: {duration}ms"
		></div>
	</div>
{/if}

<style>
	@keyframes shrink-width {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}

	.progress-bar {
		animation: shrink-width linear forwards;
		animation-duration: var(--duration);
		height: 2px;
	}
</style>
