<script lang="ts">
	import { CheckCircleSolid } from 'flowbite-svelte-icons';
	let { class: cls = '' }: { class?: string } = $props();
</script>

<CheckCircleSolid class="text-green-500 bg-white rounded-full {cls}" />
