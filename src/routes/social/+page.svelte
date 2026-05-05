<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Table,
		TableHead,
		TableHeadCell,
		TableBody,
		TableBodyRow,
		TableBodyCell,
		Button,
		Tooltip
	} from 'flowbite-svelte';
	import { UserAddOutline, ArrowUpDownOutline, ArrowUpOutline, ArrowDownOutline } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts.js';
	import CustomAlert from '$lib/components/CustomAlert.svelte';

	const { data } = $props();

	// ── Add new trustee ──────────────────────────────────────────────────────────
	let usernameToBeAdded = $state('');
	let showDropdown = $state(false);
	let addFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	let filteredUsers = $derived(
		usernameToBeAdded.length > 1
			? data.users.filter(
					(user) =>
						user.username.toLowerCase().includes(usernameToBeAdded.toLowerCase()) &&
						!data.trustNetwork.some((n: { id: string }) => n.id === user.id) &&
						user.id !== data.currentUser.id
				)
			: []
	);

	// ── Table: search / sort / paginate ──────────────────────────────────────────
	let tableSearch = $state('');
	type SortCol = 'username' | 'theyTrustMe' | 'iTrustThem';
	let sortCol = $state<SortCol>('username');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let currentPage = $state(0);
	const perPage = 10;

	let filtered = $derived(
		[...data.trustNetwork]
			.filter((e) => e.username.toLowerCase().includes(tableSearch.toLowerCase()))
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

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- HEADER -->
<div class="pb-4 px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center mb-2 lg:mb-4">
		<h2 class="mb-4 text-2xl tracking-tight font-extrabold text-tinte-900 dark:text-white">
			{texts.ui.trustedPeople}
		</h2>
		<p class="font-light text-tinte-500 dark:text-tinte-400">
			{texts.ui.trustDescriptionSocial}
			zutraust. Du kannst dann
			<a href={resolve('/user/items')} class="text-primary hover:underline"
				>{texts.pages.social.yourItems}</a
			>
			nur für diese Menschen sichtbar machen.
		</p>
	</div>
</div>

<!-- ADD TRUSTEE SEARCH -->
 
<div id="searchbar" class="mb-6 p-2 flex items-center justify-center">
	<div class="relative w-full max-w-md">
		<input
			type="text"
			placeholder="Suche nach Namen zum Hinzufügen..."
			class="search-bar w-full"
			bind:value={usernameToBeAdded}
			onfocus={() => (showDropdown = true)}
			oninput={() => (showDropdown = true)}
			onfocusoutcapture={() => setTimeout(() => (showDropdown = false), 200)}
		/>

		{#if showDropdown && filteredUsers.length > 0}
			<div
				class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-tinte-300 bg-sand shadow-lg dark:border-primary-700 dark:bg-primary-900"
			>
				{#each filteredUsers as potentialFriend (potentialFriend.id)}
					<div class="flex items-center hover:bg-primary-50 dark:hover:bg-primary-900">
						<a
							href={resolve(`/users/[id]`, { id: potentialFriend.id })}
							class="flex-1 p-3 text-tinte-900 dark:text-white"
						>
							@{potentialFriend.username}
						</a>
						<form
							method="POST"
							action="?/addTrustee"
							use:enhance={() => {
								return async ({ result, update }) => {
									await update();
									usernameToBeAdded = '';
									showDropdown = false;
									if (result.type === 'success' && result.data) {
										addFeedback = { type: 'success', message: result.data.message as string };
									} else if (result.type === 'failure') {
										addFeedback = { type: 'error', message: (result.data?.message as string) ?? texts.errors.somethingWentWrong };
									}
								};
							}}
						>
							<input type="hidden" name="trusteeId" value={potentialFriend.id} />
							<input type="hidden" name="trusteeUsername" value={potentialFriend.username} />
							<button
								type="submit"
								id="add-btn-{potentialFriend.id}"
								class="mx-2 flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-white cursor-pointer hover:bg-primary-700 transition-colors"
							>
								<UserAddOutline class="h-6 w-6" />
							</button>
							<Tooltip triggeredBy="#add-btn-{potentialFriend.id}" type="light" placement="left">
								als Vertraute(n) hinzufügen
							</Tooltip>
						</form>
					</div>
				{/each}
			</div>
		{/if}
		{#if addFeedback}
			<div class="mt-3">
				<CustomAlert type={addFeedback.type} message={addFeedback.message} />
			</div>
		{/if}
	</div>
</div>

{#snippet sortIcon(col: SortCol)}
	{#if sortCol !== col}
		<ArrowUpDownOutline class="shrink-0 h-3 w-3" />
	{:else if sortDir === 'asc'}
		<ArrowUpOutline class="shrink-0 h-3 w-3" />
	{:else}
		<ArrowDownOutline class="shrink-0 h-3 w-3" />
	{/if}
{/snippet}

<!-- TRUST NETWORK TABLE -->
<div class="mx-auto max-w-2xl px-2">
	<Table hoverable divClass="relative overflow-x-auto bg-transparent" class="w-full text-sm text-left text-gray-500 dark:text-gray-400 bg-transparent">
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
			<!-- Filter row -->
			<tr>
				<th class="bg-transparent! px-3 py-2" colspan={4}>
					<input
						type="search"
						placeholder="Netzwerk durchsuchen..."
						class="search-bar w-full text-sm font-normal"
						bind:value={tableSearch}
						oninput={() => (currentPage = 0)}
					/>
				</th>
			</tr>
		</TableHead>
		<TableBody>
			{#if paginated.length === 0}
				<TableBodyRow class="bg-transparent!">
					<TableBodyCell colspan={4} class="text-center text-tinte-500 dark:text-tinte-400 bg-transparent!">
						{tableSearch ? 'Keine Treffer.' : texts.ui.trustNetworkEmpty}
					</TableBodyCell>
				</TableBodyRow>
			{/if}
			{#each paginated as entry (entry.id)}
				<TableBodyRow class="bg-transparent!">

					<!-- Username -->
					<TableBodyCell class="max-w-30 whitespace-nowrap overflow-hidden text-ellipsis">
						<a
							href={resolve(`/users/[id]`, { id: entry.id })}
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
						<input
							type="checkbox"
							checked={entry.theyTrustMe}
							disabled
							class="w-4 h-4 rounded border-tinte-600 text-primary-600 bg-gray-100 dark:bg-gray-700 dark:border-gray-600"
						/>
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
								class="w-4 h-4 rounded border-tinte-600 text-primary-600 bg-gray-100 dark:bg-gray-700 dark:border-gray-600 cursor-pointer focus:ring-primary-500"
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
			<Button
				size="sm"
				color="alternative"
				disabled={currentPage === 0}
				onclick={() => (currentPage -= 1)}
			>
				← Zurück
			</Button>
			<span class="text-sm text-tinte-500 dark:text-tinte-400">
				{currentPage + 1} / {totalPages}
			</span>
			<Button
				size="sm"
				color="alternative"
				disabled={currentPage >= totalPages - 1}
				onclick={() => (currentPage += 1)}
			>
				Weiter →
			</Button>
		</div>
	{/if}
</div>
