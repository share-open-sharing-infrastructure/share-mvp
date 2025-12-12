<div class="flex min-h-screen flex-col items-center justify-center">
	<div class="spinner"></div>
	<h1 class="mt-4 text-xl">Logging you out...</h1>
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
