<script lang="ts">
	import { texts } from '$lib/texts';
	import ProfileImageField from './ProfileImageField.svelte';

	/**
	 * "Profil" section body of the profile settings form: username, profile image and
	 * bio. Renders the `username` / `bio` form fields (plus ProfileImageField's) — must
	 * sit inside the page's #profile-settings-form, like the other section components.
	 */
	interface Props {
		username: string;
		bio: string;
		profileImageUrl: string | null;
		ondirty?: () => void;
	}

	let { username, bio, profileImageUrl, ondirty }: Props = $props();

	// Issue #558: seed once, then bind: — never one-way value=, or hydration clobbers
	// pre-hydration input; see docs/best-practices.md → "Editable fields: seed-once + bind:,
	// never one-way value=".
	// svelte-ignore state_referenced_locally
	let usernameValue = $state(username);
	// svelte-ignore state_referenced_locally
	let bioValue = $state(bio);
</script>

<div class="mt-4 space-y-4">
	<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
		<label
			for="username"
			class="sm:w-36 sm:shrink-0 text-sm font-medium text-tinte-900 dark:text-white"
		>
			{texts.ui.username}
		</label>
		<input
			type="text"
			name="username"
			id="username"
			bind:value={usernameValue}
			class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			required
		/>
	</div>

	<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
		<label
			for="profileImage"
			class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
		>
			{texts.pages.profile.profileImageLabel}
		</label>
		<div class="sm:flex-1">
			<ProfileImageField imageUrl={profileImageUrl} {ondirty} />
		</div>
	</div>

	<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
		<label
			for="bio"
			class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white"
		>
			{texts.pages.profile.bioLabel}
		</label>
		<textarea
			name="bio"
			id="bio"
			rows="4"
			bind:value={bioValue}
			class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-y"
			placeholder={texts.pages.profile.bioPlaceholder}
		></textarea>
	</div>
</div>
