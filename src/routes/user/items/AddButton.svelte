<script lang="ts">
	import { Button } from 'flowbite-svelte';

	let { onclick, floating } = $props();
</script>

<Button
	{onclick}
	class="
        {floating ? 'fixed right-10 bottom-10' : ''}
        z-50
        h-10
        min-button
        bg-secondary
    "
>
	Hinzufügen
</Button>
