<script lang="ts">
	import { texts } from '$lib/texts';

	interface Props {
		imageUrl: string | null;
	}

	const { imageUrl }: Props = $props();
</script>

<!-- Profile image preview + delete button (button submits the standalone form in +page.svelte) -->
{#if imageUrl}
	<div class="flex items-center gap-3 mb-2">
		<img src={imageUrl} alt="" class="h-16 w-16 rounded-full object-cover" />
		<button
			type="submit"
			form="delete-profile-image-form"
			class="text-sm text-accent-600 hover:text-accent-800 hover:underline cursor-pointer"
		>
			{texts.pages.profile.deleteProfileImage}
		</button>
	</div>
{/if}

<!-- File input — part of the parent profile form -->
<input
	type="file"
	name="profileImage"
	id="profileImage"
	accept="image/*"
	class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
/>
