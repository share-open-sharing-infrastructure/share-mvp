<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { EditOutline } from 'flowbite-svelte-icons';
	let { onclick } = $props();
</script>

<Button
	class="
        w-30
        h-10
        border
        bg-gray-800
        p-1 text-white 
        hover:bg-gray-900
        focus:ring-4 focus:ring-gray-300 focus:outline-none 
        min-button
        dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
	{onclick}
>
	Bearbeiten  <EditOutline class="me-2 h-4 w-4 ml-1" />
</Button>
