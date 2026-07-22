<script lang="ts">
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { texts } from '$lib/texts';

	// Rendered inside FilterModal (issue #505): holds no navigation of its own. The selection
	// is local draft state, bound up to the modal, and only committed to the URL when
	// "Filter anwenden" is clicked there.
	interface Props {
		groups: { id: string; name: string }[];
		selectedGroup: string | null;
	}

	let { groups, selectedGroup = $bindable() }: Props = $props();

	function onChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		selectedGroup = value || null;
	}
</script>

<!-- Only rendered when the user has groups (implies logged in); guests never see it. -->
<div class="flex flex-wrap gap-2">
	<label for="group-filter" class="sr-only">{texts.pages.search.groupFilterLabel}</label>
	<!-- Styled as a pill matching the category chips / owner-type toggle: highlighted (primary)
	     when a group is active, native arrow removed via appearance-none + custom chevron. -->
	<div class="relative inline-flex">
		<select
			id="group-filter"
			value={selectedGroup ?? ''}
			onchange={onChange}
			class="max-w-60 cursor-pointer appearance-none truncate rounded-full border py-1 pl-3 pr-8 text-sm font-medium transition-colors focus:ring-primary
				{selectedGroup
				? 'border-primary bg-primary text-white'
				: 'border-tinte-300 bg-papier text-tinte-700 hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-300 dark:hover:border-primary dark:hover:text-primary'}"
		>
			<option value="">{texts.pages.search.groupFilterAll}</option>
			{#each groups as group (group.id)}
				<option value={group.id}>{group.name}</option>
			{/each}
		</select>
		<ChevronDownOutline
			class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 {selectedGroup
				? 'text-white'
				: 'text-tinte-500 dark:text-tinte-400'}"
		/>
	</div>
</div>
