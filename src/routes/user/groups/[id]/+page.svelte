<script lang="ts">
	import { Button, Input, Label, Textarea, Card } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { ArrowLeftOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let copied = $state(false);

	// German required-message instead of the browser's localized default.
	function requireName(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		if (el.validity.valueMissing) el.setCustomValidity(texts.groups.nameRequired);
	}
	function clearValidity(e: Event) {
		(e.currentTarget as HTMLInputElement).setCustomValidity('');
	}

	async function copyLink(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
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

	<!-- Group details -->
	<section class="space-y-3">
		<h1 class="text-2xl font-bold text-tinte-900">{data.group.name}</h1>
		<form method="POST" action="?/updateGroup" class="space-y-3" use:enhance>
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
			<Label class="space-y-2">
				<span>{texts.groups.descriptionLabel}</span>
				<Textarea name="description" class="h-20" value={data.group.description} />
			</Label>
			<Button type="submit" class="bg-primary-200 hover:bg-primary min-button">{texts.buttons.save}</Button>
		</form>
	</section>

	<!-- Invite link -->
	<section class="space-y-3">
		<h2 class="text-lg font-semibold text-tinte-900">{texts.groups.inviteLink}</h2>
		<p class="text-sm text-tinte-500">{texts.groups.inviteIntro}</p>
		{#if data.invite}
			<Card class="p-4 space-y-3">
				<div class="flex items-center gap-2">
					<Input type="text" readonly value={data.invite.url} class="text-xs" />
					<Button class="bg-primary-200 hover:bg-primary min-button shrink-0" onclick={() => copyLink(data.invite!.url)}>
						{copied ? texts.groups.linkCopied : texts.groups.copyLink}
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

		<form method="POST" action="?/addMember" class="flex items-end gap-2" use:enhance>
			<Label class="space-y-1 flex-1">
				<span class="text-sm">{texts.groups.addMember}</span>
				<Input type="text" name="username" placeholder={texts.groups.addMemberPlaceholder} required />
			</Label>
			<Button type="submit" class="bg-primary-200 hover:bg-primary min-button">{texts.buttons.add}</Button>
		</form>

		{#if data.members.length === 0}
			<p class="text-sm text-tinte-400">{texts.groups.noMembers}</p>
		{:else}
			<ul class="divide-y divide-tinte-100">
				{#each data.members as m (m.membershipId)}
					<li class="flex items-center justify-between py-3">
						<div>
							<span class="font-medium text-tinte-900">{m.username}</span>
							{#if m.hasActiveLending}
								<span class="ms-2 inline-flex items-center text-xs text-danger">
									<ExclamationCircleSolid class="me-1 h-3.5 w-3.5" />{texts.groups.activeLendingBadge}
								</span>
							{/if}
						</div>
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
</div>
