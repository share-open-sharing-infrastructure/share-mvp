<script lang="ts">
	import { texts } from '$lib/texts';

	interface Props {
		imageUrl: string | null;
		/** Called when the field changes, so the parent can mark the settings form dirty. */
		ondirty?: () => void;
	}

	const { imageUrl, ondirty }: Props = $props();

	// Removal is deferred to the shared save bar (consistent with uploading a new photo):
	// flagging it just hides the preview and submits removeProfileImage=true with the form.
	let pendingRemove = $state(false);

	function markRemove() {
		pendingRemove = true;
		ondirty?.();
	}
</script>

{#if imageUrl && !pendingRemove}
	<div class="flex items-center gap-3 mb-2">
		<img src={imageUrl} alt="" class="h-16 w-16 rounded-full object-cover" />
		<button
			type="button"
			onclick={markRemove}
			class="text-sm text-accent-600 hover:text-accent-800 hover:underline cursor-pointer"
		>
			{texts.pages.profile.deleteProfileImage}
		</button>
	</div>
{:else if imageUrl && pendingRemove}
	<div class="flex items-center gap-3 mb-2">
		<span role="status" class="text-sm text-tinte-600 dark:text-tinte-400">
			{texts.pages.profile.profileImageWillBeRemoved}
		</span>
		<button
			type="button"
			onclick={() => (pendingRemove = false)}
			class="text-sm font-medium text-primary hover:underline cursor-pointer dark:text-primary-400"
		>
			{texts.pages.profile.undoRemoveProfileImage}
		</button>
	</div>
	<!-- Picked up by ?/saveProfile; ignored if a new file is also chosen. -->
	<input type="hidden" name="removeProfileImage" value="true" />
{/if}

<!-- File input — part of the parent profile form. Choosing a file cancels a pending removal. -->
<input
	type="file"
	name="profileImage"
	id="profileImage"
	accept="image/*"
	onchange={() => (pendingRemove = false)}
	class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
/>
