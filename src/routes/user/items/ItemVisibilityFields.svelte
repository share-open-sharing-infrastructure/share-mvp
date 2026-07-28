<script lang="ts">
	import { Label, Toggle, Checkbox } from 'flowbite-svelte';
	import { ChevronRightOutline, QuestionCircleSolid } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	/**
	 * The visibility section of the item add/edit modal: the trustees-only toggle (with
	 * its info panel) and the group-sharing checkboxes (with the public-group warning).
	 * Renders the `trusteesOnly` / `groups` form fields — must sit inside the modal's
	 * <form>. Trustees and groups are independent audiences; an item is public only
	 * when neither is set.
	 */
	interface Props {
		groups?: { id: string; name: string; isPublic?: boolean }[];
		trusteesOn: boolean;
		selectedGroups: string[];
	}

	let { groups = [], trusteesOn = $bindable(), selectedGroups = $bindable() }: Props = $props();

	let showTrustInfo = $state(false);

	let isPublic = $derived(!trusteesOn && selectedGroups.length === 0);

	// A selected PUBLIC group means anyone can self-join and thus see this item —
	// warn the owner so sharing into a public group is a conscious choice.
	let anyPublicGroupSelected = $derived(
		groups.some((g) => g.isPublic && selectedGroups.includes(g.id))
	);
</script>

<!-- VISIBILITY: trustees and groups are independent audiences -->
<div class="flex items-center">
	<Label class="flex">
		<Toggle
			name="trusteesOnly"
			classes={{ span: 'bg-primary-300 peer-checked:bg-safety' }}
			bind:checked={trusteesOn}
			>{texts.groups.itemTrusteesLabel}</Toggle
		>
	</Label>
	<!-- Info button lives OUTSIDE the <Label> so clicking it doesn't toggle the switch. -->
	<button
		type="button"
		class="flex items-center text-sm font-light text-tinte-500 dark:text-tinte-400"
		onclick={() => (showTrustInfo = !showTrustInfo)}
	>
		<QuestionCircleSolid class="ml-1 h-full" />
		<span class="sr-only">{texts.ui.explainThis}</span>
	</button>
</div>
{#if showTrustInfo}
	<div class="space-y-1 rounded-lg border border-tinte-200 bg-sand p-3 text-sm text-tinte-500">
		<p class="font-semibold text-tinte-900">{texts.groups.trustInfoTitle}</p>
		<p>{texts.groups.trustInfoBody}</p>
		<a href={resolve('/social')} class="flex items-center font-medium text-accent hover:underline">
			{texts.groups.trustInfoAddLink}<ChevronRightOutline class="ms-1.5 h-4 w-4 text-accent" />
		</a>
	</div>
{/if}

<!-- GROUP SHARING (independent of the trustees toggle) -->
<div class="space-y-2 rounded-lg border border-tinte-200 bg-sand p-3">
	<span class="text-sm font-medium text-tinte-900">{texts.groups.itemShareTitle}</span>
	{#if groups.length === 0}
		<p class="text-sm text-tinte-500">{texts.groups.noGroupsForItem}</p>
		<a href={resolve('/user/groups')} class="flex items-center text-sm font-medium text-accent hover:underline">
			{texts.groups.goToGroups}<ChevronRightOutline class="ms-1.5 h-4 w-4 text-accent" />
		</a>
	{:else}
		<p class="text-xs text-tinte-500">{texts.groups.itemShareHint}</p>
		<div class="flex flex-col gap-1.5">
			{#each groups as g (g.id)}
				<Label class="flex cursor-pointer items-center gap-2 font-normal">
					<Checkbox
						name="groups"
						value={g.id}
						bind:group={selectedGroups}
					/>
					{g.name}
					{#if g.isPublic}
						<span class="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-800 dark:bg-primary-900 dark:text-primary-200">{texts.groups.publicBadge}</span>
					{/if}
				</Label>
			{/each}
		</div>
		{#if anyPublicGroupSelected}
			<p class="text-xs font-medium text-danger">{texts.groups.itemPublicGroupWarning}</p>
		{/if}
	{/if}
</div>

{#if isPublic}
	<p class="text-xs text-tinte-500">{texts.groups.itemPublicHint}</p>
{/if}
