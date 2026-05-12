<script lang="ts">
	import { UserCircleOutline, HomeOutline, CheckCircleOutline } from 'flowbite-svelte-icons';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import type { User } from '$lib/types/models';

	interface Props {
		owner: User;
		ownerImageUrl: string | null;
		ownerTrustsViewer: boolean;
		ownerItemCount: number;
		isAuthenticated: boolean;
		isOwnItem: boolean;
	}

	const { owner, ownerImageUrl, ownerTrustsViewer, ownerItemCount, isAuthenticated, isOwnItem }: Props = $props();

	const isInstitution = $derived(!!owner.isInstitution);
	const cardTitle = $derived(
		isInstitution ? texts.pages.itemDetail.institutionCardTitle : texts.pages.itemDetail.ownerCardTitle
	);
	const registeredSince = $derived(
		new Date(owner.created).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
	);
</script>

<div class="rounded-lg border border-tinte-200 dark:border-tinte-700 p-4 space-y-3 bg-sand dark:bg-tinte-800">
	<h2 class="text-xs font-semibold text-tinte-500 dark:text-tinte-400 uppercase tracking-wide">
		{cardTitle}
	</h2>

	<div class="flex items-start gap-3">
		<!-- Avatar -->
		{#if ownerImageUrl}
			<img
				src={ownerImageUrl}
				alt={owner.username}
				class="h-12 w-12 rounded-full object-cover shrink-0 mt-0.5"
			/>
		{:else if isInstitution}
			<HomeOutline class="h-12 w-12 text-tinte-400 shrink-0 mt-0.5" />
		{:else}
			<UserCircleOutline class="h-12 w-12 text-tinte-400 shrink-0 mt-0.5" />
		{/if}

		<!-- Info -->
		<div class="min-w-0 space-y-1">
			<!-- Name + verified badge -->
			<div class="flex items-center gap-1.5 flex-wrap">
				<a
					href={resolve('/users/[id]', { id: owner.id })}
					class="font-semibold text-tinte-900 dark:text-white hover:text-primary hover:underline"
				>
					{owner.username}
				</a>
				<!-- Email verification -->
				{#if owner.verified}
					<span class="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
						<CheckCircleOutline class="h-3.5 w-3.5 shrink-0" />
						{texts.pages.userProfile.emailVerified}
					</span>
				{/if}
			</div>

			<!-- Meta: registered since + item count -->
			<p class="text-sm text-tinte-500 dark:text-tinte-400">
				{texts.pages.userProfile.activeSince(registeredSince)}
				·
				{texts.pages.itemDetail.ownerItemCount(ownerItemCount)}
			</p>


			<!-- Trust indicator (Owner → Viewer) -->
			{#if isAuthenticated && !isOwnItem && !isInstitution}
				<p class="text-sm {ownerTrustsViewer ? 'text-green-700 dark:text-green-400' : 'text-tinte-400 dark:text-tinte-500'}">
					{ownerTrustsViewer
						? texts.pages.userProfile.trustsYou
						: texts.pages.userProfile.doesNotTrustYou}
				</p>
			{/if}

			<!-- Bio (institutions + regular users with bios) -->
			{#if owner.bio}
				<p class="text-sm text-tinte-700 dark:text-tinte-400 line-clamp-3 whitespace-pre-wrap pt-1">
					{owner.bio}
				</p>
			{/if}
		</div>
	</div>
</div>
