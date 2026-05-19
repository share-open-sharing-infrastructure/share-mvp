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
	import { UserAddOutline, SearchOutline, ArrowUpDownOutline, ArrowUpOutline, ArrowDownOutline, CheckCircleOutline } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts.js';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import InviteShareButton from '$lib/components/InviteShareButton.svelte';

	const { data } = $props();

	// ── Unified search ───────────────────────────────────────────────────────────
	let search = $state('');
	let showAddDropdown = $state(false);
	let addFeedback = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	let filteredUsers = $derived(
		search.length > 1
			? data.users.filter(
					(user) =>
						user.username.toLowerCase().includes(search.toLowerCase()) &&
						!data.trustNetwork.some((n: { id: string }) => n.id === user.id) &&
						user.id !== data.currentUser.id
				)
			: []
	);

	// ── Table: sort / paginate ────────────────────────────────────────────────────
	type SortCol = 'username' | 'theyTrustMe' | 'iTrustThem';
	let sortCol = $state<SortCol>('username');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let currentPage = $state(0);
	const perPage = 10;

	let filtered = $derived(
		[...data.trustNetwork]
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

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>


<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
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

<!-- INVITE SECTION -->
<div class="max-w-2xl mx-auto px-4 py-6">
	<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8">
		<h2 class="text-lg font-semibold text-tinte-900 dark:text-white mb-2">
			{texts.pages.invite.sectionTitle}
		</h2>
		<p class="text-sm text-tinte-600 dark:text-tinte-400 mb-4">
			{texts.pages.invite.description}
		</p>
		<div class="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
			<input
				type="text"
				readonly
				value={data.inviteUrl}
				class="flex-1 px-3 py-2 bg-tinte-100 border border-tinte-200 rounded-lg text-sm text-tinte-600 cursor-default dark:bg-tinte-700 dark:border-tinte-600 dark:text-tinte-400 truncate"
			/>
			<InviteShareButton inviteUrl={data.inviteUrl} username={data.username} />
		</div>
	</div>
</div>

<!-- UNIFIED SEARCH BAR -->
<div class="mb-6 px-2 flex items-center justify-center">
	<div class="relative w-full max-w-md">
		<div class="relative flex items-center">
			<input
				type="text"
				placeholder="Netzwerk durchsuchen..."
				class="search-bar w-full pr-10"
				bind:value={search}
				oninput={() => { currentPage = 0; showAddDropdown = false; }}
			/>
			{#if search.length > 1}
				<button
					type="button"
					onclick={() => (showAddDropdown = !showAddDropdown)}
					class="flex absolute right-2 text-tinte-400 hover:text-primary transition-colors cursor-pointer"
					title="Nutzer:in hinzufügen"
				>
					<span class="text-md text-tinte-400 mr-2">Noch nicht im Netzwerk? Suche</span>
					<SearchOutline class="h-5 w-5" />
				</button>
			{/if}
		</div>

		{#if showAddDropdown}
			<div class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-tinte-300 bg-sand shadow-lg dark:border-primary-700 dark:bg-primary-900">
				{#if filteredUsers.length === 0}
					<p class="p-3 text-sm text-tinte-400">Keine neuen Nutzer:innen gefunden.</p>
				{:else}
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
								use:enhance={() => async ({ result, update }) => {
									await update();
									search = '';
									showAddDropdown = false;
									if (result.type === 'success' && result.data) {
										addFeedback = { type: 'success', message: result.data.message as string };
									} else if (result.type === 'failure') {
										addFeedback = { type: 'error', message: (result.data?.message as string) ?? texts.errors.somethingWentWrong };
									}
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
								<Tooltip triggeredBy="#add-btn-{potentialFriend.id}" type="light" placement="left" trigger="click">
									als Vertraute(n) hinzufügen
								</Tooltip>
							</form>
						</div>
					{/each}
				{/if}
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
		</TableHead>
		<TableBody>
			{#if paginated.length === 0}
				<TableBodyRow class="bg-transparent!">
					<TableBodyCell colspan={4} class="text-center text-tinte-500 dark:text-tinte-400 bg-transparent!">
						{search ? 'Keine Treffer.' : texts.ui.trustNetworkEmpty}
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
			<Button
				size="sm"
				class="min-button bg-primary-200 hover:bg-primary"
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
				class="min-button bg-primary-200 hover:bg-primary"
				disabled={currentPage >= totalPages - 1}
				onclick={() => (currentPage += 1)}
			>
				Weiter →
			</Button>
		</div>
	{/if}
</div>
