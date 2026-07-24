<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Table,
		TableHead,
		TableHeadCell,
		TableBody,
		TableBodyRow,
		TableBodyCell
	} from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ArrowUpDownOutline, ArrowUpOutline, ArrowDownOutline, CheckCircleOutline } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts.js';

	/**
	 * The sortable, paginated trust-network table of /social (rows post to the page's
	 * ?/addTrustee / ?/removeTrustee actions). Owns all sort/pagination state; the page
	 * passes the network plus the shared search term (also used by its add-user dropdown).
	 */
	interface Props {
		trustNetwork: {
			id: string;
			username: string;
			profilePic: string;
			iTrustThem: boolean;
			theyTrustMe: boolean;
		}[];
		search: string;
	}

	const { trustNetwork, search }: Props = $props();

	type SortCol = 'username' | 'theyTrustMe' | 'iTrustThem';
	let sortCol = $state<SortCol>('username');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let currentPage = $state(0);
	const perPage = 10;

	// A changed search term re-filters the rows — jump back to the first page so the
	// pager can't point past the (possibly shorter) new result set.
	$effect(() => {
		void search;
		currentPage = 0;
	});

	let filtered = $derived(
		[...trustNetwork]
			.filter((e) => e.username.toLowerCase().includes(search.toLowerCase()))
			.sort((a, b) => {
				const mul = sortDir === 'asc' ? 1 : -1;
				if (sortCol === 'username') return mul * a.username.localeCompare(b.username);
				// boolean sort: true=1, false=0; desc puts true first
				return mul * (Number(a[sortCol]) - Number(b[sortCol]));
			})
	);

	let totalPages = $derived(Math.ceil(filtered.length / perPage));
	let paginated = $derived(filtered.slice(currentPage * perPage, (currentPage + 1) * perPage));

	function toggleSort(col: SortCol) {
		if (sortCol === col) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortCol = col;
			// Boolean columns: start desc so "true" rows appear first
			sortDir = col === 'username' ? 'asc' : 'desc';
		}
		currentPage = 0;
	}
</script>

{#snippet sortIcon(col: SortCol)}
	{#if sortCol !== col}
		<ArrowUpDownOutline class="shrink-0 h-3 w-3" />
	{:else if sortDir === 'asc'}
		<ArrowUpOutline class="shrink-0 h-3 w-3" />
	{:else}
		<ArrowDownOutline class="shrink-0 h-3 w-3" />
	{/if}
{/snippet}

<div class="mx-auto max-w-2xl px-2">
	<Table hoverable classes={{ div: "relative overflow-x-auto bg-transparent" }} class="w-full text-sm text-left text-gray-500 dark:text-gray-400 bg-transparent">
		<TableHead defaultRow={false} class="bg-transparent!">
			<!-- Sort header row -->
			<tr>
				<TableHeadCell
					class="cursor-pointer select-none bg-transparent!"
					onclick={() => toggleSort('username')}
				>
					<span class="flex items-center gap-1 whitespace-nowrap">Nutzer:in {@render sortIcon('username')}</span>
				</TableHeadCell>
				<TableHeadCell
					class="w-15 sm:w-40 cursor-pointer select-none text-center bg-transparent!"
					onclick={() => toggleSort('theyTrustMe')}
				>
					<span class="flex flex-wrap items-center justify-center gap-1">{texts.ui.theyTrustYou} {@render sortIcon('theyTrustMe')}</span>
				</TableHeadCell>
				<TableHeadCell
					class="w-15 sm:w-40 cursor-pointer select-none text-center bg-transparent!"
					onclick={() => toggleSort('iTrustThem')}
				>
					<span class="flex flex-wrap items-center justify-center gap-1">{texts.ui.youTrustThem} {@render sortIcon('iTrustThem')}</span>
				</TableHeadCell>
			</tr>
		</TableHead>
		<TableBody>
			{#if paginated.length === 0}
				<TableBodyRow class="bg-transparent!">
					<TableBodyCell colspan={3} class="text-center text-tinte-500 dark:text-tinte-400 bg-transparent!">
						{search ? 'Keine Treffer.' : texts.ui.trustNetworkEmpty}
					</TableBodyCell>
				</TableBodyRow>
			{/if}
			{#each paginated as entry (entry.id)}
				<TableBodyRow class="bg-transparent!">

					<!-- Username -->
					<TableBodyCell class="max-w-30 whitespace-nowrap overflow-hidden text-ellipsis">
						<a
							href={resolve('/users/[id]', { id: entry.id })}
							class="flex flex-row items-center font-medium text-tinte-900 dark:text-white hover:underline"
						>
							<img
								src={entry.profilePic}
								alt="@{entry.username}"
								class="h-9 w-9 mr-4 shrink-0 rounded-full object-cover hidden sm:block"
							/>
							{entry.username}
						</a>
					</TableBodyCell>

					<!-- Vertraut dir (read-only) -->
					<TableBodyCell class="text-center">
						{#if entry.theyTrustMe}
							<CheckCircleOutline class="h-5 w-5 text-green-500 inline" />
						{/if}
					</TableBodyCell>

					<!-- Du vertraust (interactive) -->
					<TableBodyCell class="text-center">
						<form
							method="POST"
							action={entry.iTrustThem ? '?/removeTrustee' : '?/addTrustee'}
							use:enhance
						>
							<input type="hidden" name="trusteeId" value={entry.id} />
							<input
								type="checkbox"
								checked={entry.iTrustThem}
								class="w-4 h-4 rounded-full border-tinte-600 text-green-500 bg-gray-100 dark:bg-gray-700 dark:border-gray-600 cursor-pointer focus:ring-primary-500"
								onchange={(e) => (e.target as HTMLInputElement).form?.requestSubmit()}
							/>
						</form>
					</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>

	<!-- PAGINATION -->
	{#if totalPages > 1}
		<div class="flex items-center justify-between mt-4 px-1">
			<Button size="sm" disabled={currentPage === 0} onclick={() => (currentPage -= 1)}>
				← Zurück
			</Button>
			<span class="text-sm text-tinte-500 dark:text-tinte-400">
				{currentPage + 1} / {totalPages}
			</span>
			<Button size="sm" disabled={currentPage >= totalPages - 1} onclick={() => (currentPage += 1)}>
				Weiter →
			</Button>
		</div>
	{/if}
</div>
