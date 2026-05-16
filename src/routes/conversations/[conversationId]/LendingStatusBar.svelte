<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import type { Conversation } from '$lib/types/models';

	interface Props {
		lendingStatus: Conversation['lendingStatus'];
		isOwner: boolean;
		/** Username of the item owner — shown in the borrower-facing pending description. */
		itemOwnerUsername: string;
	}

	let { lendingStatus, isOwner, itemOwnerUsername }: Props = $props();

	const status = $derived(lendingStatus);

	// The five forward-progress steps. `rejected` is a dead-end handled separately below.
	const steps: Array<NonNullable<Conversation['lendingStatus']>> = [
		'pending',
		'accepted',
		'active',
		'return_requested',
		'completed',
	];

	const currentStepIndex = $derived(status ? steps.indexOf(status) : -1);

	// States where the bar is filled up to and including this step
	function isStepReached(idx: number): boolean {
		return idx <= currentStepIndex && status !== 'rejected';
	}

	// Description text differs by role. `pending` is handled first because its borrower
	// variant is dynamic (includes the owner's name). The remaining states all have a
	// plain string per role, typed here to keep the lookup below typesafe.
	type RoleAwareStatus = 'accepted' | 'active' | 'return_requested';
	const descriptionText = $derived.by(() => {
		if (!status) return '';
		if (status === 'completed') return texts.lending.statusDescription.completed;
		if (status === 'rejected') return texts.lending.statusDescription.rejected;
		if (status === 'pending') {
			const d = texts.lending.statusDescription.pending;
			return isOwner ? d.owner : d.requester(itemOwnerUsername);
		}
		const desc = texts.lending.statusDescription[status as RoleAwareStatus];
		return isOwner ? desc.owner : desc.requester;
	});

	const actionBtnClass =
		'rounded-full px-3 py-1.5 text-xs font-semibold bg-primary-200 hover:bg-primary text-tinte-900 transition-colors cursor-pointer';
	const secondaryBtnClass =
		'rounded-full px-3 py-1.5 text-xs font-semibold border border-tinte-300 dark:border-tinte-600 text-tinte-600 dark:text-tinte-300 hover:bg-tinte-100 dark:hover:bg-tinte-800 transition-colors cursor-pointer';
</script>

{#if status}
	<div class="border-b border-tinte-100 dark:border-tinte-800 bg-papier dark:bg-tinte-900 px-4 py-3 space-y-3 shrink-0">
		{#if status === 'rejected'}
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-gray-100 dark:bg-tinte-800 text-tinte-500 dark:text-tinte-400 border border-gray-200 dark:border-tinte-700">
					{texts.lending.statusLabel.rejected}
				</span>
				<span class="text-xs text-tinte-500 dark:text-tinte-400">
					{texts.lending.statusDescription.rejected}
				</span>
			</div>
		{:else}
			<!-- Progress bar: one segment per step -->
			<div class="flex items-center gap-1">
				{#each steps as step, idx (step)}
					<div class="flex-1 flex flex-col items-center gap-1 min-w-0">
						<div class="w-full h-1.5 rounded-full {isStepReached(idx) ? 'bg-primary' : 'bg-gray-200 dark:bg-tinte-700'}"></div>
						<span class="hidden sm:block text-xs truncate w-full text-center {isStepReached(idx) ? 'text-primary dark:text-primary-300' : 'text-tinte-400 dark:text-tinte-500'}">
							{texts.lending.statusLabel[step]}
						</span>
					</div>
				{/each}
			</div>

			<!-- Current status + description + action buttons -->
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2 min-w-0">
					<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 border border-primary-200 dark:border-primary-700 shrink-0">
						{texts.lending.statusLabel[status]}
					</span>
					<span class="text-xs text-tinte-500 dark:text-tinte-400">
						{descriptionText}
					</span>
				</div>

				<div class="flex items-center gap-2 shrink-0">
					{#if status === 'pending' && isOwner}
						<form method="POST" action="?/rejectRequest" use:enhance>
							<button type="submit" class={secondaryBtnClass}>
								{texts.lending.actions.reject}
							</button>
						</form>
						<form method="POST" action="?/acceptRequest" use:enhance>
							<button type="submit" class={actionBtnClass}>
								{texts.lending.actions.accept}
							</button>
						</form>
					{:else if status === 'accepted' && isOwner}
						<form method="POST" action="?/confirmHandover" use:enhance>
							<button type="submit" class={actionBtnClass}>
								{texts.lending.actions.confirmHandover}
							</button>
						</form>
					{:else if status === 'active'}
						{#if !isOwner}
							<form method="POST" action="?/requestReturn" use:enhance>
								<button type="submit" class={actionBtnClass}>
									{texts.lending.actions.requestReturn}
								</button>
							</form>
						{:else}
							<form method="POST" action="?/confirmReturn" use:enhance>
								<button type="submit" class={secondaryBtnClass}>
									{texts.lending.actions.confirmReturn}
								</button>
							</form>
						{/if}
					{:else if status === 'return_requested' && isOwner}
						<form method="POST" action="?/confirmReturn" use:enhance>
							<button type="submit" class={actionBtnClass}>
								{texts.lending.actions.confirmReturn}
							</button>
						</form>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
