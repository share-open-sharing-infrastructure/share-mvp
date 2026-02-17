<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import { EditOutline } from 'flowbite-svelte-icons';
	let { onclick } = $props();
</script>

<Button
	class="
        w-10
        h-10
        cursor-pointer
        border
        p-1
        min-button
        bg-primary
        "
	{onclick}
>
	<EditOutline class="h-4 w-4" />
</Button>
