<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import OnboardingButton from './OnboardingButton.svelte';

	interface Props {
		onNext: () => void;
		currentUser: { id: string; profileImage?: string; bio?: string };
		pbUrl: string;
	}

	let { onNext, currentUser, pbUrl }: Props = $props();

	let errorMessage = $state<string | undefined>(undefined);
	let previewUrl = $state<string | null>(null);

	const existingImageUrl = $derived(
		currentUser.profileImage
			? `${pbUrl}/api/files/users/${currentUser.id}/${currentUser.profileImage}`
			: null
	);

	const displayImageUrl = $derived(previewUrl ?? existingImageUrl);

	function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = file ? URL.createObjectURL(file) : null;
	}
</script>

<div class="space-y-5">
	<h2 class="text-xl font-bold text-tinte-900 dark:text-white text-center">
		{texts.onboarding.profile.title}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400 leading-relaxed">
		{texts.onboarding.profile.explanation}
	</p>

	{#if errorMessage}
		<CustomAlert type="error" message={errorMessage} />
	{/if}

	<form
		method="POST"
		action="?/saveProfile"
		enctype="multipart/form-data"
		class="space-y-5"
		use:enhance={() =>
			({ result }) => {
				if (result.type === 'success' || result.type === 'failure') {
					onNext();
				}
			}}
	>
		<!-- Profile image -->
		<div>
			<label for="profileImage" class="block text-sm font-medium text-tinte-900 dark:text-white mb-2">
				{texts.onboarding.profile.imageLabel}
			</label>
			{#if displayImageUrl}
				<img src={displayImageUrl} alt="" class="h-20 w-20 rounded-full object-cover mb-3" />
			{/if}
			<input
				type="file"
				name="profileImage"
				id="profileImage"
				accept="image/*"
				onchange={handleFileChange}
				class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
			/>
		</div>

		<!-- Bio -->
		<div>
			<label
				for="bio"
				class="block text-sm font-medium text-tinte-900 dark:text-white mb-2"
			>
				{texts.onboarding.profile.bioLabel}
			</label>
			<textarea
				id="bio"
				name="bio"
				rows="3"
				placeholder={texts.onboarding.profile.bioPlaceholder}
				class="w-full px-3 py-2 bg-papier border border-tinte-300 rounded-lg text-sm text-tinte-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-tinte-700 dark:border-tinte-600 dark:text-white resize-none"
			>{currentUser.bio ?? ''}</textarea>
		</div>

		<div class="flex flex-col gap-2 pt-1">
			<OnboardingButton type="submit">{texts.onboarding.buttons.next}</OnboardingButton>
			<OnboardingButton type="button" variant="ghost" onclick={onNext}>
				{texts.onboarding.buttons.skip}
			</OnboardingButton>
		</div>
	</form>
</div>
