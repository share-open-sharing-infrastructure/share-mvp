<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		const timer = setTimeout(() => {
			goto('/');
		}, 5000);

		return () => clearTimeout(timer);
	});
</script>


<div class="flex flex-col items-center justify-center">
	<div class="spinner"></div>
	<h1 class="mt-4 text-xl">Du bist jetzt für den AllerLeih Newsletter registriert! Du wirst in 5 Sekunden auf die Homepage weitergeleitet.</h1>
</div>

<style>
	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid rgba(0, 0, 0, 0.1);
		border-left-color: #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	:global(.dark) .spinner {
		border-color: rgba(255, 255, 255, 0.1);
		border-left-color: #60a5fa;
	}
</style>
