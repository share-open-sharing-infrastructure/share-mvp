<script lang="ts">
	import { Button, Input, Label, Textarea, Card, Toggle } from 'flowbite-svelte';
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
	import InviteShareButton from '$lib/components/InviteShareButton.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Track the public toggle so we can warn only when newly enabling it.
	let makePublic = $state(data.group.isPublic);

	// Separate copy-feedback per target so the public-link and invite-link
	// buttons don't both flip to "kopiert!" at once.
	let copiedKey = $state<string | null>(null);

	// Add-member search (owner only): client-side filter over candidate users,
	// mirroring the trust-network search on /social.
	let memberSearch = $state('');
	let showAddDropdown = $state(false);
	let filteredCandidates = $derived(
		memberSearch.length > 1
			? data.candidateUsers
					.filter((u) => u.username.toLowerCase().includes(memberSearch.toLowerCase()))
					.slice(0, 20)
			: []
	);

	// German required-message instead of the browser's localized default.
	function requireName(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		if (el.validity.valueMissing) el.setCustomValidity(texts.groups.nameRequired);
	}
	function clearValidity(e: Event) {
		(e.currentTarget as HTMLInputElement).setCustomValidity('');
	}

	async function copyLink(url: string, key: string) {
		try {
			await navigator.clipboard.writeText(url);
			copiedKey = key;
			setTimeout(() => (copiedKey = null), 2000);
		} catch {
			/* clipboard unavailable */
		}
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-6 space-y-8">
	<a href={resolve('/user/groups')} class="inline-flex items-center text-sm text-accent hover:underline">
		<ArrowLeftOutline class="me-1 h-4 w-4" />{texts.groups.pageTitle}
	</a>

	{#if form?.fail}
		<CustomAlert type="error" message={form?.message} />
	{/if}

	{#if data.isOwner}
		<!-- ─────────────── OWNER: full management ─────────────── -->

		<!-- Group details -->
		<section class="space-y-3">
			<h1 class="text-2xl font-bold text-tinte-900">{data.group.name}</h1>
			<form method="POST" action="?/updateGroup" class="space-y-4" use:enhance>
				<Label class="space-y-2">
					<span>{texts.groups.nameLabel}</span>
					<Input
						type="text"
						name="name"
						value={data.group.name}
						required
						oninvalid={requireName}
						oninput={clearValidity}
					/>
				</Label>
				<Label class="space-y-2 block w-full">
					<span>{texts.groups.descriptionLabel}</span>
					<Textarea name="description" class="h-24 w-full" value={data.group.description} />
				</Label>
				<div class="space-y-1">
					<Toggle name="isPublic" bind:checked={makePublic}>{texts.groups.publicToggle}</Toggle>
					<p class="text-xs text-tinte-400 ps-11">{texts.groups.publicToggleHint}</p>
				</div>
				<div class="flex justify-end">
					<Button
						type="submit"
						class="bg-primary-200 hover:bg-primary min-button"
						onclick={(e) => {
							// Confirm only when newly switching the group to public.
							if (makePublic && !data.group.isPublic && !confirm(texts.groups.publicConfirm)) {
								e.preventDefault();
							}
						}}
					>{texts.buttons.save}</Button>
				</div>
			</form>
		</section>

		<!-- Public link (only when the group is public: anyone can self-join) -->
		{#if data.group.isPublic}
			<section class="space-y-2">
				<h2 class="text-lg font-semibold text-tinte-900">{texts.groups.publicLinkTitle}</h2>
				<p class="text-sm text-tinte-500">{texts.groups.publicLinkIntro}</p>
				<div class="flex flex-col sm:flex-row gap-2">
					<Input type="text" readonly value={data.publicUrl} class="w-full text-xs" />
					<Button
						class="bg-primary-200 hover:bg-primary min-button w-full sm:w-auto shrink-0"
						onclick={() => copyLink(data.publicUrl, 'public')}
					>
						{copiedKey === 'public' ? texts.groups.linkCopied : texts.groups.copyLink}
					</Button>
				</div>
			</section>
		{/if}

		<!-- Invite link -->
		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-tinte-900">{texts.groups.inviteLink}</h2>
			<p class="text-sm text-tinte-500">{texts.groups.inviteIntro}</p>
			{#if data.invite}
				<Card class="p-4 space-y-3 w-full max-w-none">
					<Input type="text" readonly value={data.invite.url} class="w-full text-xs" />
					<div class="flex flex-col sm:flex-row gap-2">
						<InviteShareButton
							inviteUrl={data.invite.url}
							shareText={texts.groups.shareText(data.group.name)}
							label={texts.groups.shareGroupButton}
						/>
						<Button
							class="bg-primary-200 hover:bg-primary min-button w-full sm:w-auto shrink-0"
							onclick={() => copyLink(data.invite!.url, 'invite')}
						>
							{copiedKey === 'invite' ? texts.groups.linkCopied : texts.groups.copyLink}
						</Button>
					</div>
					<p class="text-xs text-tinte-400">
						{texts.groups.inviteUsage(data.invite.uses, data.invite.maxUses)}
						{#if data.invite.expiresAt}· {texts.groups.inviteUntil} {new Date(data.invite.expiresAt).toLocaleDateString('de-DE')}{/if}
					</p>
					<div class="flex gap-2">
						<form method="POST" action="?/revokeInvite" use:enhance>
							<input type="hidden" name="inviteId" value={data.invite.id} />
							<Button type="submit" class="bg-accent-200 hover:bg-danger min-button text-sm">{texts.groups.revokeInvite}</Button>
						</form>
					</div>
				</Card>
			{:else}
				<p class="text-sm text-tinte-400">{texts.groups.noInvite}</p>
			{/if}
			<form method="POST" action="?/createInvite" class="flex flex-wrap items-end gap-3" use:enhance>
				<Label class="space-y-1 text-sm">
					<span>{texts.groups.expiresLabel}</span>
					<Input type="date" name="expiresAt" />
				</Label>
				<Label class="space-y-1 text-sm">
					<span>{texts.groups.maxUsesLabel}</span>
					<Input type="number" name="maxUses" min="0" value="0" class="w-24" />
				</Label>
				<Button type="submit" class="bg-primary-200 hover:bg-primary min-button">
					{data.invite ? texts.groups.regenerateInvite : texts.groups.createInvite}
				</Button>
			</form>
		</section>

		<!-- Members -->
		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-tinte-900">{texts.groups.members}</h2>

			<!-- Add-member search (autosuggest over existing users) -->
			<div class="relative">
				<Input
					type="text"
					autocomplete="off"
					placeholder={texts.groups.addMemberSearchPlaceholder}
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

			{#if data.members.length === 0}
				<p class="text-sm text-tinte-400">{texts.groups.noMembers}</p>
			{:else}
				<p class="text-xs text-tinte-400 flex items-center gap-1">
					<InfoCircleOutline class="h-3.5 w-3.5" />{texts.groups.activeLendingExplain}
				</p>
				<ul class="divide-y divide-tinte-100">
					{#each data.members as m (m.membershipId)}
						<li class="flex items-center justify-between py-3">
							<div>
								<span class="font-medium text-tinte-900">{m.username}</span>
								{#if m.isOwner}
									<span class="ms-2">{texts.groups.you}</span>
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
							{#if m.role !== 'admin'}
								<form method="POST" action="?/removeMember" use:enhance>
									<input type="hidden" name="membershipId" value={m.membershipId} />
									<Button
										type="submit"
										class="bg-accent-200 hover:bg-danger min-button text-sm"
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
		</section>

		<!-- Danger zone -->
		<section class="space-y-3 border-t border-tinte-100 pt-6">
			<form method="POST" action="?/deleteGroup" use:enhance>
				<Button
					type="submit"
					class="bg-accent-200 hover:bg-danger min-button"
					onclick={(e) => {
						if (!confirm(texts.groups.deleteConfirm)) e.preventDefault();
					}}
				>
					{texts.groups.deleteGroup}
				</Button>
			</form>
		</section>
	{:else}
		<!-- ─────────────── MEMBER: read-only ─────────────── -->
		<section class="space-y-2">
			<h1 class="text-2xl font-bold text-tinte-900">{data.group.name}</h1>
			<p class="text-sm text-tinte-500">{texts.groups.memberView}</p>
			{#if data.group.description}
				<p class="whitespace-pre-line text-tinte-700">{data.group.description}</p>
			{/if}
		</section>

		<section class="space-y-3">
			<h2 class="text-lg font-semibold text-tinte-900">{texts.groups.members}</h2>
			<ul class="divide-y divide-tinte-100">
				{#each data.members as m (m.membershipId)}
					<li class="flex items-center gap-2 py-3">
						<span class="font-medium text-tinte-900">{m.username}</span>
						{#if m.userId === data.currentUserId}
							<span class="text-tinte-400">{texts.groups.you}</span>
						{/if}
						{#if m.role === 'admin'}
							<span class="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-800 dark:bg-primary-900 dark:text-primary-200">
								{texts.groups.adminBadge}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section class="space-y-3 border-t border-tinte-100 pt-6">
			<form method="POST" action={resolve('/user/groups') + '?/leave'} use:enhance>
				<input type="hidden" name="groupId" value={data.group.id} />
				<Button
					type="submit"
					class="bg-accent-200 hover:bg-danger min-button"
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
