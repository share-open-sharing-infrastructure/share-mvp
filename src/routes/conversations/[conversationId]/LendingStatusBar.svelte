<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import type { Conversation } from '$lib/types/models';
	import { LENDING_LIFECYCLE, canAbortUi, canTransition, type LendingStatus } from '$lib/lending';
	import Button from '$lib/components/ui/Button.svelte';

	interface Props {
		lendingStatus: Conversation['lendingStatus'];
		isOwner: boolean;
		/** Username of the item owner — shown in the borrower-facing pending description. */
		itemOwnerUsername: string;
		/** Opens the abort-confirmation modal (owned by the parent). */
		onAbort?: () => void;
	}

	let { lendingStatus, isOwner, itemOwnerUsername, onAbort }: Props = $props();

	// Short alias used throughout this file; keeps template expressions concise.
	const status = $derived(lendingStatus);

	// `rejected` and `aborted` are both terminal dead-ends: no progress bar, just a
	// gray badge + description. Values are resolved here to keep the template's type
	// narrowing simple.
	const isDeadEnd = $derived(status === 'rejected' || status === 'aborted');
	const deadEndLabel = $derived(
		status === 'aborted' ? texts.lending.statusLabel.aborted : texts.lending.statusLabel.rejected
	);
	const deadEndDescription = $derived(
		status === 'aborted'
			? texts.lending.statusDescription.aborted
			: texts.lending.statusDescription.rejected
	);

	// Who may abort, per the approved role/state rules (#373) — see `canAbortUi`'s doc
	// comment in $lib/lending.ts for why this is intentionally NOT the same rule the
	// server enforces for the abort transition itself.
	const showAbort = $derived(!!onAbort && canAbortUi(status, isOwner));

	// A conversation only ever has these two roles, so `isRequester` is just the negation.
	// Action-button visibility is derived from the same `LENDING_TRANSITIONS` table the
	// server enforces (via `canTransition`) instead of re-deriving the role/status rule
	// per button — keeps this list from drifting out of sync with the server guard.
	const role = $derived({ isOwner, isRequester: !isOwner });
	const showReject = $derived(canTransition('rejectRequest', role, status));
	const showAccept = $derived(canTransition('acceptRequest', role, status));
	const showConfirmHandover = $derived(canTransition('confirmHandover', role, status));
	const showRequestReturn = $derived(canTransition('requestReturn', role, status));
	const showConfirmReturn = $derived(canTransition('confirmReturn', role, status));
	// Visual weight only: `confirmReturn` is the secondary action while still `active`
	// (the borrower may yet request a return) but becomes the primary CTA once a return
	// has actually been requested.
	const confirmReturnVariant = $derived(status === 'return_requested' ? 'primary' : 'secondary');

	// The five forward-progress steps. `rejected` is a dead-end handled separately below.
	const steps: readonly LendingStatus[] = LENDING_LIFECYCLE;

	const currentStepIndex = $derived(status ? steps.indexOf(status) : -1);

	// States where the bar is filled up to and including this step
	function isStepReached(idx: number): boolean {
		return idx <= currentStepIndex && !isDeadEnd;
	}

	// Description text differs by role. `pending` is handled first because its borrower
	// variant is dynamic (includes the owner's name). The remaining states all have a
	// plain string per role, typed here to keep the lookup below typesafe.
	type RoleAwareStatus = 'accepted' | 'active' | 'return_requested';
	const descriptionText = $derived.by(() => {
		if (!status) return '';
		if (status === 'completed') return texts.lending.statusDescription.completed;
		if (status === 'rejected') return texts.lending.statusDescription.rejected;
		if (status === 'aborted') return texts.lending.statusDescription.aborted;
		if (status === 'pending') {
			const pendingDesc = texts.lending.statusDescription.pending;
			return isOwner ? pendingDesc.owner : pendingDesc.requester(itemOwnerUsername);
		}
		const desc = texts.lending.statusDescription[status as RoleAwareStatus];
		return isOwner ? desc.owner : desc.requester;
	});

</script>

{#snippet actionForm(action: string, label: string, variant: 'primary' | 'secondary')}
	<form method="POST" {action} use:enhance>
		<Button type="submit" {variant} size="sm">{label}</Button>
	</form>
{/snippet}

{#if status}
	<div class="border-b border-tinte-100 dark:border-tinte-800 bg-papier dark:bg-tinte-900 px-4 sm:py-3 space-y-3 shrink-0">
		{#if isDeadEnd}
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-tinte-800 text-tinte-500 dark:text-tinte-400 border border-gray-200 dark:border-tinte-700">
					{deadEndLabel}
				</span>
				<span class="text-xs text-tinte-500 dark:text-tinte-400">
					{deadEndDescription}
				</span>
			</div>
		{:else}
			<!-- Progress bar: one segment per step -->
			<div class="flex items-start gap-1">
				{#each steps as step, idx (step)}
					{@const labeled = idx === currentStepIndex || idx === currentStepIndex + 1}
					<div class="flex flex-col items-center gap-1 {labeled ? 'flex-none sm:flex-1' : 'flex-1 min-w-0'}">
						<div class="w-full h-1.5 rounded-full {isStepReached(idx) ? 'bg-primary' : 'bg-gray-200 dark:bg-tinte-700'}"></div>
						<span class="text-xs text-center w-full leading-tight px-2
							{labeled ? 'block whitespace-nowrap sm:truncate' : 'hidden sm:block sm:truncate'}
							{isStepReached(idx) ? 'text-primary dark:text-primary-300' : 'text-tinte-400 dark:text-tinte-500'}">
							{texts.lending.statusLabel[step]}
						</span>
					</div>
				{/each}
			</div>

			<!-- Current status + description + action buttons -->
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 min-w-0">
					<!-- <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 border border-primary-200 dark:border-primary-700 shrink-0">
						{texts.lending.statusLabel[status]}
					</span> -->
					<span class="text-xs line-clamp-2 text-tinte-500 dark:text-tinte-400">
						{descriptionText}
					</span>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					{#if showReject}
						{@render actionForm('?/rejectRequest', texts.lending.actions.reject, 'secondary')}
					{/if}
					{#if showAccept}
						{@render actionForm('?/acceptRequest', texts.lending.actions.accept, 'primary')}
					{/if}
					{#if showConfirmHandover}
						{@render actionForm('?/confirmHandover', texts.lending.actions.confirmHandover, 'primary')}
					{/if}
					{#if showRequestReturn}
						{@render actionForm('?/requestReturn', texts.lending.actions.requestReturn, 'primary')}
					{/if}
					{#if showConfirmReturn}
						{@render actionForm('?/confirmReturn', texts.lending.actions.confirmReturn, confirmReturnVariant)}
					{/if}
					{#if showAbort}
						<!-- Opens the confirmation modal in the parent; the actual mutation
						     is the parent's ?/abortRequest form. -->
						<Button variant="secondary" size="sm" onclick={() => onAbort?.()}>
							{texts.lending.actions.abort}
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
