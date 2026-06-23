<script lang="ts">
	import { Button, Modal, Label, Input, Textarea, Card } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { UsersGroupOutline, ChevronRightOutline } from 'flowbite-svelte-icons';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreate = $state(false);

	// Show the German required-message instead of the browser's localized default.
	function requireName(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		if (el.validity.valueMissing) el.setCustomValidity(texts.groups.nameRequired);
	}
	function clearValidity(e: Event) {
		(e.currentTarget as HTMLInputElement).setCustomValidity('');
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-6 space-y-6">
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-2xl font-bold text-tinte-900">{texts.groups.pageTitle}</h1>
		<Button class="bg-primary-200 hover:bg-primary min-button" onclick={() => (showCreate = true)}>
			{texts.groups.create}
		</Button>
	</div>

	<p class="text-sm text-tinte-500">{texts.groups.intro}</p>

	{#if form?.fail}
		<CustomAlert type="error" message={form?.message} />
	{/if}

	<!-- Owned groups -->
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-tinte-900">{texts.groups.ownedTitle}</h2>
		{#if data.owned.length === 0}
			<p class="text-sm text-tinte-400">{texts.groups.noOwnedGroups}</p>
		{:else}
			{#each data.owned as g (g.id)}
				<a href={resolve(`/user/groups/${g.id}`)} class="block">
					<Card class="flex-row items-center justify-between p-4 hover:shadow-md transition">
						<div class="flex items-center gap-3">
							<UsersGroupOutline class="h-6 w-6 text-accent" />
							<div>
								<p class="font-semibold text-tinte-900">{g.name}</p>
								<p class="text-xs text-tinte-400">{texts.groups.memberCount(g.memberCount)}</p>
							</div>
						</div>
						<span class="flex items-center text-sm font-medium text-accent">
							{texts.groups.manage}<ChevronRightOutline class="ms-1 h-4 w-4" />
						</span>
					</Card>
				</a>
			{/each}
		{/if}
	</section>

	<!-- Member groups -->
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-tinte-900">{texts.groups.memberTitle}</h2>
		{#if data.member.length === 0}
			<p class="text-sm text-tinte-400">{texts.groups.noMemberGroups}</p>
		{:else}
			{#each data.member as g (g.id)}
				<Card class="flex-row items-center justify-between p-4">
					<div class="flex items-center gap-3">
						<UsersGroupOutline class="h-6 w-6 text-tinte-400" />
						<div>
							<p class="font-semibold text-tinte-900">{g.name}</p>
							<p class="text-xs text-tinte-400">{texts.groups.memberCount(g.memberCount)}</p>
						</div>
					</div>
					<form method="POST" action="?/leave" use:enhance>
						<input type="hidden" name="groupId" value={g.id} />
						<Button
							type="submit"
							class="bg-accent-200 hover:bg-danger min-button text-sm"
							onclick={(e) => {
								if (!confirm(texts.groups.leaveConfirm)) e.preventDefault();
							}}
						>
							{texts.groups.leave}
						</Button>
					</form>
				</Card>
			{/each}
		{/if}
	</section>
</div>

<!-- Create group modal -->
<Modal bind:open={showCreate} size="xs" title={texts.groups.createTitle}>
	<form
		method="POST"
		action="?/create"
		class="flex flex-col space-y-4"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') showCreate = false;
				await update();
			};
		}}
	>
		<Label class="space-y-2">
			<span>{texts.groups.nameLabel}</span>
			<Input
				type="text"
				name="name"
				placeholder={texts.groups.namePlaceholder}
				required
				oninvalid={requireName}
				oninput={clearValidity}
			/>
		</Label>
		<Label class="space-y-2">
			<span>{texts.groups.descriptionLabel}</span>
			<Textarea name="description" placeholder={texts.groups.descriptionPlaceholder} class="h-24" />
		</Label>
		<Button type="submit" class="bg-primary-200 hover:bg-primary min-button">
			{texts.groups.create}
		</Button>
	</form>
</Modal>
