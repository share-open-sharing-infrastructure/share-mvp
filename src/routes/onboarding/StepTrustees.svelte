<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import type { User } from '$lib/types/models';
	import OnboardingButton from './OnboardingButton.svelte';

	interface Props {
		onNext: () => void;
		users: User[];
		trustIds: string[];
		currentUserId: string;
	}

	let { onNext, users, trustIds, currentUserId }: Props = $props();

	let query = $state('');
	let showDropdown = $state(false);

	let filteredUsers = $derived(
		query.length > 1
			? users.filter(
					(u) =>
						u.username.toLowerCase().includes(query.toLowerCase()) &&
						!trustIds.includes(u.id) &&
						u.id !== currentUserId
				)
			: []
	);

	let trustees = $derived(users.filter((u) => trustIds.includes(u.id)));
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold text-tinte-900 dark:text-white text-center">
		{texts.onboarding.trustees.title}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400 leading-relaxed">
		{texts.onboarding.trustees.explanation}
	</p>

	<!-- Search input -->
	<div class="relative">
		<input
			type="text"
			placeholder={texts.onboarding.trustees.searchPlaceholder}
			bind:value={query}
			onfocus={() => (showDropdown = true)}
			oninput={() => (showDropdown = true)}
			onfocusoutcapture={() => setTimeout(() => (showDropdown = false), 200)}
			class="w-full px-3 py-2 bg-papier border border-tinte-300 rounded-lg text-sm text-tinte-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-tinte-700 dark:border-tinte-600 dark:text-white"
		/>

		{#if showDropdown && filteredUsers.length > 0}
			<ul class="absolute z-10 mt-1 w-full bg-sand border border-tinte-200 rounded-lg shadow-lg dark:bg-tinte-800 dark:border-tinte-600 max-h-48 overflow-auto">
				{#each filteredUsers as user (user.id)}
					<li>
						<form
							method="POST"
							action="?/addTrustee"
							use:enhance={() => async ({ update }) => {
								await update();
								query = '';
								showDropdown = false;
							}}
						>
							<input type="hidden" name="trusteeId" value={user.id} />
							<button
								type="submit"
								class="w-full text-left px-3 py-2 text-sm text-tinte-800 dark:text-tinte-200 hover:bg-tinte-100 dark:hover:bg-tinte-700"
							>
								@{user.username}
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else if showDropdown && query.length > 1}
			<div class="absolute z-10 mt-1 w-full bg-sand border border-tinte-200 rounded-lg shadow-lg dark:bg-tinte-800 dark:border-tinte-600 px-3 py-2 text-sm text-tinte-500 dark:text-tinte-400">
				{texts.onboarding.trustees.noResults}
			</div>
		{/if}
	</div>

	<!-- Current trustees -->
	<div class="min-h-[3rem]">
		{#if trustees.length === 0}
			<p class="text-sm text-tinte-400 dark:text-tinte-500 text-center py-2">
				{texts.onboarding.trustees.noTrusteesYet}
			</p>
		{:else}
			<ul class="space-y-1">
				{#each trustees as trustee (trustee.id)}
					<li class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-papier dark:bg-tinte-700/50 text-sm text-tinte-800 dark:text-tinte-200">
						<span class="text-primary">✓</span>
						@{trustee.username}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="flex flex-col gap-2 pt-2">
		<OnboardingButton onclick={onNext}>{texts.onboarding.buttons.next} →</OnboardingButton>
		<OnboardingButton variant="ghost" onclick={onNext}>{texts.onboarding.buttons.skip}</OnboardingButton>
	</div>
</div>
