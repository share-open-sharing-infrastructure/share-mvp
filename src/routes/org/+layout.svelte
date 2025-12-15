<script lang="ts">
	let { children } = $props();
</script>

<div class="mx-auto min-h-[50vh] max-w-3xl px-20 text-center">
	{@render children()}
</div>
