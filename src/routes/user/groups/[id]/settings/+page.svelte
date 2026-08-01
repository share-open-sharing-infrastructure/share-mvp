<script lang="ts">
	import { Input, Label, Textarea, Toggle, Card } from 'flowbite-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { ArrowLeftOutline } from 'flowbite-svelte-icons';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import ShareButton from '$lib/components/ShareButton.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Track the public toggle so we can warn only when newly enabling it.
	// (Pre-existing, not #613: seeded once from `data` and never re-synced, so
	// state_referenced_locally fires here too — ignored for the same reason as the seeds below.)
	// svelte-ignore state_referenced_locally
	let makePublic = $state(data.group.isPublic);

	// Issue #613: seed once from the loaded value, then let the field own it via bind: — never a
	// one-way value= on an editable field. Flowbite's Input/Textarea binding internally does not
	// make the outer one-way prop safe; the un-bound prop is a writable derived that the root
	// layout's afterNavigate invalidate recomputes right after hydration, discarding what the
	// user typed. Full mechanism: docs/best-practices.md → "Editable fields: seed-once + bind:,
	// never one-way value=".
	//
	// Trade-off (same as #558/`bio`): ?/updateGroup runs update({ reset: false }) → invalidateAll(),
	// so after a save these fields keep the value the user typed rather than the server-trimmed one.
	// The page's <h1> still reads data.group.name, so the heading shows the stored value.
	// svelte-ignore state_referenced_locally
	let nameValue = $state(data.group.name);
	// svelte-ignore state_referenced_locally
	let descriptionValue = $state(data.group.description);

	// Separate copy-feedback per target so the public-link and invite-link
	// buttons don't both flip to "kopiert!" at once.
	let copiedKey = $state<string | null>(null);

	const cardClass =
		'bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8';
	const sectionTitleClass = 'text-lg font-semibold text-tinte-900 dark:text-white';

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

<div class="mx-auto max-w-5xl px-4 py-6 space-y-6">
	<a href={resolve('/user/groups/[id]', { id: data.group.id })} class="inline-flex items-center text-sm text-accent hover:underline">
		<ArrowLeftOutline class="me-1 h-4 w-4" />{texts.groups.backToGroup}
	</a>

	<h1 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">
		{data.group.name} · {texts.groups.settings}
	</h1>

	{#if form?.fail}
		<CustomAlert type="error" message={form?.message} />
	{/if}

	<!-- Group details -->
	<section class={cardClass}>
		<h2 class={sectionTitleClass}>{texts.groups.detailsTitle}</h2>
		<form
			method="POST"
			action="?/updateGroup"
			class="mt-4 space-y-4"
			use:enhance={() => async ({ update }) => {
				// Don't reset the form on success: a native form reset flips the
				// `isPublic` toggle (bound to `makePublic`) back to its initial value,
				// even though the server already saved the new value. Re-running load
				// via invalidateAll still refreshes data.group.isPublic.
				await update({ reset: false });
			}}
		>
			<Label class="space-y-2">
				<span>{texts.groups.nameLabel}</span>
				<Input
					type="text"
					name="name"
					bind:value={nameValue}
					required
					oninvalid={requireName}
					oninput={clearValidity}
				/>
			</Label>
			<Label class="space-y-2 block w-full">
				<span>{texts.groups.descriptionLabel}</span>
				<Textarea name="description" class="h-24 w-full" bind:value={descriptionValue} />
			</Label>
			<div class="space-y-1">
				<Toggle name="isPublic" bind:checked={makePublic}>{texts.groups.publicToggle}</Toggle>
				<p class="text-xs text-tinte-400 ps-11">{texts.groups.publicToggleHint}</p>
			</div>
			<div class="flex justify-end">
				<Button
					type="submit"
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
		<section class={cardClass}>
			<h2 class={sectionTitleClass}>{texts.groups.publicLinkTitle}</h2>
			<p class="mt-2 text-sm text-tinte-500">{texts.groups.publicLinkIntro}</p>
			<div class="mt-4 flex flex-col sm:flex-row gap-2">
				<Input type="text" readonly value={data.publicUrl} aria-label={texts.groups.publicLinkTitle} class="w-full text-xs" />
				<Button
					class="w-full sm:w-auto shrink-0"
					onclick={() => copyLink(data.publicUrl, 'public')}
				>
					{copiedKey === 'public' ? texts.groups.linkCopied : texts.groups.copyLink}
				</Button>
			</div>
		</section>
	{/if}

	<!-- Invite link -->
	<section class={cardClass}>
		<h2 class={sectionTitleClass}>{texts.groups.inviteLink}</h2>
		<p class="mt-2 text-sm text-tinte-500">{texts.groups.inviteIntro}</p>
		<div class="mt-4 space-y-3">
			{#if data.invite}
				<Card class="p-4 space-y-3 w-full max-w-none">
					<Input type="text" readonly value={data.invite.url} aria-label={texts.groups.inviteLink} class="w-full text-xs" />
					<div class="flex flex-col sm:flex-row gap-2">
						<ShareButton
							url={data.invite.url}
							shareText={texts.groups.shareText(data.group.name)}
							label={texts.groups.shareGroupButton}
						/>
						<Button
							class="w-full sm:w-auto shrink-0"
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
							<Button type="submit" variant="danger" size="sm">{texts.groups.revokeInvite}</Button>
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
				<Button type="submit">
					{data.invite ? texts.groups.regenerateInvite : texts.groups.createInvite}
				</Button>
			</form>
		</div>
	</section>

	<!-- Danger zone -->
	<section class={cardClass}>
		<h2 class={sectionTitleClass}>{texts.groups.dangerZone}</h2>
		<form method="POST" action="?/deleteGroup" class="mt-4" use:enhance>
			<Button
				type="submit"
				variant="danger"
				onclick={(e) => {
					if (!confirm(texts.groups.deleteConfirm)) e.preventDefault();
				}}
			>
				{texts.groups.deleteGroup}
			</Button>
		</form>
	</section>
</div>
