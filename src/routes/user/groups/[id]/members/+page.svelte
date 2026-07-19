<script lang="ts">
	import { Input } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import {
		ArrowLeftOutline,
		ExclamationCircleSolid,
		InfoCircleOutline,
		UserAddOutline
	} from 'flowbite-svelte-icons';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Add-member search (owner only): client-side filter over candidate users.
	let memberSearch = $state('');
	let showAddDropdown = $state(false);
	let filteredCandidates = $derived(
		memberSearch.length > 1
			? data.candidateUsers
					.filter((u) => u.username.toLowerCase().includes(memberSearch.toLowerCase()))
					.slice(0, 20)
			: []
	);

	const cardClass =
		'bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8';
	const sectionTitleClass = 'text-lg font-semibold text-tinte-900 dark:text-white';
</script>

<div class="mx-auto max-w-5xl px-4 py-6 space-y-6">
	<a href={resolve(`/user/groups/${data.group.id}`)} class="inline-flex items-center text-sm text-accent hover:underline">
		<ArrowLeftOutline class="me-1 h-4 w-4" />{texts.groups.backToGroup}
	</a>

	<h1 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">
		{data.group.name} · {texts.groups.members}
	</h1>

	{#if form?.fail}
		<CustomAlert type="error" message={form?.message} />
	{/if}

	<!-- Members roster (+ add-member for the owner) -->
	<section class={cardClass}>
		<h2 class={sectionTitleClass}>{texts.groups.members}</h2>
		<div class="mt-4 space-y-3">
			{#if data.isOwner}
				<div class="relative">
					<Input
						type="text"
						autocomplete="off"
						placeholder={texts.groups.addMemberSearchPlaceholder}
						aria-label={texts.groups.addMemberSearchPlaceholder}
						bind:value={memberSearch}
						oninput={() => (showAddDropdown = true)}
					/>
					{#if showAddDropdown && memberSearch.length > 1}
						<div class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-tinte-300 bg-sand shadow-lg dark:border-primary-700 dark:bg-primary-900">
							{#if filteredCandidates.length === 0}
								<p class="p-3 text-sm text-tinte-400">{texts.groups.addMemberNoResults}</p>
							{:else}
								{#each filteredCandidates as cand (cand.id)}
									<form
										method="POST"
										action="?/addMember"
										use:enhance={() => async ({ update }) => {
											await update();
											memberSearch = '';
											showAddDropdown = false;
										}}
									>
										<input type="hidden" name="userId" value={cand.id} />
										<button
											type="submit"
											class="flex w-full items-center justify-between p-3 text-left text-tinte-900 hover:bg-primary-50 dark:text-white dark:hover:bg-primary-900"
										>
											<span>@{cand.username}</span>
											<UserAddOutline class="h-5 w-5 text-primary" />
										</button>
									</form>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			{#if data.members.length === 0}
				<p class="text-sm text-tinte-400">{texts.groups.noMembers}</p>
			{:else}
				{#if data.isOwner}
					<p class="text-xs text-tinte-400 flex items-center gap-1">
						<InfoCircleOutline class="h-3.5 w-3.5" />{texts.groups.activeLendingExplain}
					</p>
					<p class="text-xs text-tinte-400 flex items-start gap-1">
						<InfoCircleOutline class="h-3.5 w-3.5 shrink-0 mt-0.5" />{texts.groups.removeUnshareHint}
					</p>
				{/if}
				<ul class="divide-y divide-tinte-100 dark:divide-tinte-700">
					{#each data.members as m (m.membershipId)}
						<li class="flex items-center justify-between py-3">
							<div>
								<span class="font-medium text-tinte-900 dark:text-white">{m.username}</span>
								{#if m.userId === data.currentUserId}
									<span class="ms-2 text-tinte-400">{texts.groups.you}</span>
								{/if}
								{#if m.role === 'admin'}
									<span class="ms-2 inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-800 dark:bg-primary-900 dark:text-primary-200">
										{texts.groups.adminBadge}
									</span>
								{/if}
								{#if m.hasActiveLending}
									<span class="ms-2 inline-flex items-center text-xs text-danger">
										<ExclamationCircleSolid class="me-1 h-3.5 w-3.5" />{texts.groups.activeLendingBadge}
									</span>
								{/if}
							</div>
							{#if data.isOwner && m.role !== 'admin'}
								<form method="POST" action="?/removeMember" use:enhance>
									<input type="hidden" name="membershipId" value={m.membershipId} />
									<Button
										type="submit"
										variant="danger"
										size="sm"
										onclick={(e) => {
											const msg = m.hasActiveLending
												? texts.groups.activeLendingWarning(m.username) + '\n\n' + texts.groups.removeMemberConfirm(m.username)
												: texts.groups.removeMemberConfirm(m.username);
											if (!confirm(msg)) e.preventDefault();
										}}
									>
										{texts.groups.removeMember}
									</Button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	{#if !data.isOwner}
		<!-- Member: leave the group -->
		<section class={cardClass}>
			<form method="POST" action={resolve('/user/groups') + '?/leave'} use:enhance>
				<input type="hidden" name="groupId" value={data.group.id} />
				<Button
					type="submit"
					variant="danger"
					onclick={(e) => {
						if (!confirm(texts.groups.leaveConfirm)) e.preventDefault();
					}}
				>
					{texts.groups.leave}
				</Button>
			</form>
		</section>
	{/if}
</div>
