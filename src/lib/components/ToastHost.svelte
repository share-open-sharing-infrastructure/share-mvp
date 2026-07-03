<script lang="ts">
	import { Toast } from 'flowbite-svelte';
	import {
		CheckCircleSolid,
		CloseCircleSolid,
		InfoCircleSolid,
		CloseOutline,
	} from 'flowbite-svelte-icons';
	import { fly } from 'svelte/transition';
	import { toastStore, type ToastType } from '$lib/stores/toast.svelte';
	import { texts } from '$lib/texts';

	// Map our semantic type to a Flowbite Toast colour + icon, mirroring CustomAlert.
	const color: Record<ToastType, 'green' | 'red' | 'yellow'> = {
		success: 'green',
		error: 'red',
		warn: 'yellow',
	};
</script>

<!-- Fixed, bottom-centred stack that overlays the app so feedback is always visible
     without scrolling back up. The container is a persistent (always-mounted) polite
     live region so success/info toasts inserted into it are reliably announced; error
     toasts additionally carry role="alert" so they interrupt (assertive). -->
<div
	class="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none sm:bottom-6"
	aria-live="polite"
	aria-atomic="false"
>
	{#each toastStore.toasts as toast (toast.id)}
		<div
			role={toast.type === 'error' ? 'alert' : undefined}
			class="pointer-events-auto w-full max-w-sm"
			transition:fly={{ y: 24, duration: 250 }}
		>
			<Toast
				color={color[toast.type]}
				dismissable={false}
				class="w-full shadow-lg"
			>
				{#snippet icon()}
					{#if toast.type === 'success'}
						<CheckCircleSolid class="h-5 w-5" />
					{:else if toast.type === 'error'}
						<CloseCircleSolid class="h-5 w-5" />
					{:else}
						<InfoCircleSolid class="h-5 w-5" />
					{/if}
				{/snippet}
				<span class="font-medium">{toast.message}</span>
				<button
					type="button"
					onclick={() => toastStore.dismiss(toast.id)}
					aria-label={texts.buttons.close}
					class="ms-auto -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-tinte-400 hover:bg-tinte-100 hover:text-tinte-900 dark:hover:bg-tinte-700 dark:hover:text-white cursor-pointer"
				>
					<CloseOutline class="h-4 w-4" />
				</button>
			</Toast>
		</div>
	{/each}
</div>
