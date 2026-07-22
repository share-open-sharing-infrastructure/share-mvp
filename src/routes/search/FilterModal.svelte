<script lang="ts">
	import { Modal, Toggle } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import SegmentedControl from '$lib/components/ui/SegmentedControl.svelte';
	import CategoryFilter from './CategoryFilter.svelte';
	import GroupFilter from './GroupFilter.svelte';
	import { texts } from '$lib/texts';
	import type { SortOption } from './searchFilter';

	type OwnerType = 'all' | 'institution' | 'private';

	interface Draft {
		sort: SortOption;
		onlyAvailable: boolean;
		ownerType: OwnerType;
		selectedCategories: string[];
		op: 'or' | 'and';
		selectedGroup: string | null;
	}

	interface Props {
		open: boolean;
		// Current URL-derived state — used only to seed the local draft whenever the modal opens.
		sort: SortOption;
		onlyAvailable: boolean;
		ownerType: OwnerType;
		selectedCategories: string[];
		op: 'or' | 'and';
		selectedGroup: string | null;
		groups: { id: string; name: string }[];
		// Committed once, in a single call, when "Filter anwenden" is clicked.
		onApply: (draft: Draft) => void;
	}

	let {
		open = $bindable(),
		sort,
		onlyAvailable,
		ownerType,
		selectedCategories,
		op,
		selectedGroup,
		groups,
		onApply,
	}: Props = $props();

	// App defaults — what "Zurücksetzen" restores the draft to (issue #505 scope: reset only
	// touches the in-modal draft, it does not navigate; the user still applies to commit it).
	const DEFAULTS: Draft = {
		sort: 'newest',
		onlyAvailable: false,
		ownerType: 'all',
		selectedCategories: [],
		op: 'or',
		selectedGroup: null,
	};

	let draft = $state<Draft>({
		sort,
		onlyAvailable,
		ownerType,
		selectedCategories: [...selectedCategories],
		op,
		selectedGroup,
	});

	// Re-seed the draft from the current (URL-derived) props every time the modal opens, so a
	// previous "Zurücksetzen" (without Apply) or a stale draft never leaks into the next open.
	$effect(() => {
		if (open) {
			draft = {
				sort,
				onlyAvailable,
				ownerType,
				selectedCategories: [...selectedCategories],
				op,
				selectedGroup,
			};
		}
	});

	const sortOptions = Object.entries(texts.pages.search.sortOptions).map(([value, label]) => ({
		value: value as SortOption,
		label,
	}));

	const ownerTypeOptions: { value: OwnerType; label: string }[] = [
		{ value: 'all', label: texts.pages.search.ownerTypeAll },
		{ value: 'institution', label: texts.pages.search.ownerTypeInstitution },
		{ value: 'private', label: texts.pages.search.ownerTypePrivate },
	];

	function reset() {
		draft = { ...DEFAULTS, selectedCategories: [...DEFAULTS.selectedCategories] };
		apply();
	}

	function apply() {
		onApply({ ...draft });
	}
</script>

<Modal title={texts.pages.search.filterModalTitle} bind:open size="md" outsideclose>
	<div class="flex flex-col gap-6">
		<!-- Sortierung -->
		<section>
			<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">
				{texts.pages.search.sortLabel}
			</h3>
			<SegmentedControl
				options={sortOptions}
				bind:value={draft.sort}
				label={texts.pages.search.sortLabel}
			/>
		</section>

		<!-- Verfügbarkeit -->
		<section>
			<label class="flex items-center gap-2 cursor-pointer">
				<Toggle bind:checked={draft.onlyAvailable} aria-describedby="availability-subtext" />
				<span class="text-sm text-tinte-600 dark:text-tinte-400">
					{texts.pages.search.onlyAvailable}
				</span>
			</label>
			<p id="availability-subtext" class="sr-only">
				{texts.pages.search.filterAvailabilitySubtext}
			</p>
		</section>

		<!-- Anbieter -->
		<section>
			<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">
				{texts.pages.search.filterSectionOwnerType}
			</h3>
			<SegmentedControl
				options={ownerTypeOptions}
				bind:value={draft.ownerType}
				label={texts.pages.search.filterSectionOwnerType}
			/>
		</section>

		<!-- Kategorien -->
		<section>
			<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">
				{texts.pages.search.filterSectionCategories}
			</h3>
			<CategoryFilter bind:selectedCategories={draft.selectedCategories} bind:op={draft.op} />
		</section>

		<!-- Gruppe -->
		{#if groups.length > 0}
			<section>
				<h3 class="mb-2 text-sm font-semibold text-tinte-700 dark:text-tinte-300">
					{texts.pages.search.filterSectionGroup}
				</h3>
				<GroupFilter {groups} bind:selectedGroup={draft.selectedGroup} />
			</section>
		{/if}


		<div class="flex justify-between gap-3 border-t border-tinte-200 pt-4 dark:border-tinte-700">
			<Button variant="accent" onclick={reset}>{texts.pages.search.filterReset}</Button>
			<Button variant="primary" onclick={apply}>{texts.pages.search.filterApply}</Button>
		</div>
	</div>
</Modal>
