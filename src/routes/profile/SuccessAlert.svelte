<script>
	import { Alert } from 'flowbite-svelte';
	import { InfoCircleSolid } from 'flowbite-svelte-icons';
	import { fly } from 'svelte/transition';
</script>

<Alert
	class="mt-5"
	color="green"
	dismissable
	transition={fly}
	params={{ x: 200 }}
>
	{#snippet icon()}<InfoCircleSolid class="h-5 w-5" />{/snippet}
	<span class="font-medium">Die Änderungen wurden gespeichert!</span>
</Alert>
