<script lang="ts">
	import { Section } from 'flowbite-svelte-blocks';
	import { resolve } from '$app/paths';	
</script>

<Section>
	<div class="flex items-center justify-center">
		<a href={resolve('/')} class="text-2xl font-semibold text-gray-900 dark:text-white">
			Hier passiert was...
		</a>
	</div>
</Section>
