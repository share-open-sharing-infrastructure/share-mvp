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
	import Button from '$lib/components/ui/Button.svelte';

	// Map our semantic type to a Flowbite Toast colour + icon, mirroring CustomAlert.
	const color: Record<ToastType, 'green' | 'red' | 'yellow'> = {
		success: 'green',
		error: 'red',
		warn: 'yellow',
	};

	// A body-level fixed overlay can't beat a modal <dialog>: the dialog's full-viewport
	// ::backdrop paints above everything outside the dialog (even the Popover top-layer
	// trick — the backdrop still wins). The one thing that paints above the backdrop is a
	// node *nested inside the open dialog*. So we portal this container into the topmost
	// open modal dialog while one is open, and keep it at <body> level otherwise. The
	// target depends only on which modals are OPEN (not on toasts), so relocation is keyed
	// to modal open/close via a single document-level observer — not to toast add/remove.
	let containerEl = $state<HTMLDivElement>();

	// Open modal dialogs in the order they entered the top layer (showModal order): the LAST
	// entry is the topmost. DOM order is NOT reliable for stacked modals, so we maintain order
	// explicitly (append when a dialog becomes :modal, drop when it closes/detaches). Plain
	// `let` — never read reactively, only mutated inside these DOM callbacks.
	let openModalOrder: HTMLDialogElement[] = [];

	// Move the host under the topmost open modal dialog, or back to <body> when none is open.
	// Only touches the DOM when the parent actually changes, so it's idempotent.
	function relocate(): void {
		if (!containerEl) return;
		const target: HTMLElement = openModalOrder[openModalOrder.length - 1] ?? document.body;
		if (containerEl.parentElement !== target) target.appendChild(containerEl);
	}

	// Rebuild the open-order list from the DOM (pruning closed/detached dialogs but preserving
	// the order of those still open, appending newly opened ones), then relocate.
	function refresh(): void {
		let open: HTMLDialogElement[] = [];
		try {
			open = [...document.querySelectorAll<HTMLDialogElement>('dialog:modal')];
		} catch {
			open = []; // browser without the `:modal` selector → treat as no modal (body host)
		}
		const openSet = new Set(open);
		openModalOrder = openModalOrder.filter((d) => openSet.has(d));
		for (const d of open) if (!openModalOrder.includes(d)) openModalOrder.push(d);
		relocate();
	}

	// True when a mutation record actually concerns a <dialog> — an `open` attribute flip on a
	// <dialog> (note <details> also carries `open`, so match the tag, not just the attr name),
	// or a <dialog> added/removed (possibly nested inside an inserted/removed subtree). Lets us
	// skip the querySelector pass on the unrelated DOM churn a body-subtree observer sees.
	function isDialogMutation(record: MutationRecord): boolean {
		if (record.type === 'attributes') {
			return record.target instanceof HTMLElement && record.target.tagName === 'DIALOG';
		}
		return [...record.addedNodes, ...record.removedNodes].some(
			(n) => n instanceof HTMLElement && (n.tagName === 'DIALOG' || !!n.querySelector('dialog')),
		);
	}

	// A single document-level observer catches EVERY modal open (`open` attr added), close
	// (`open` removed / `close` event flips it), and removal (childList). Refreshing only on a
	// mutation that involves a <dialog> keeps the querySelector work rare on a busy DOM.
	$effect(() => {
		const observer = new MutationObserver((records) => {
			if (records.some(isDialogMutation)) refresh();
		});
		observer.observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['open'],
		});
		refresh(); // initial placement on mount
		return () => observer.disconnect();
	});
</script>

<!-- Fixed, bottom-centred stack that overlays the app so feedback is always visible
     without scrolling back up. The container is a persistent (always-mounted) polite
     live region so success/info toasts inserted into it are reliably announced; error
     toasts additionally carry role="alert" so they interrupt (assertive). It is portalled
     into the topmost open modal dialog while one is open (see the script) so toasts paint
     above the dialog's ::backdrop; the Tailwind fixed positioning keeps it bottom-centred
     regardless of which parent it currently lives under. -->
<div
	bind:this={containerEl}
	data-toast-host
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
				<Button
					variant="ghost"
					size="icon-sm"
					onclick={() => toastStore.dismiss(toast.id)}
					aria-label={texts.buttons.close}
					class="ms-auto -mr-1"
				>
					<CloseOutline class="h-4 w-4" />
				</Button>
			</Toast>
		</div>
	{/each}
</div>
