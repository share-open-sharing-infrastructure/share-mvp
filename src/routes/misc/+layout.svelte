<script lang="ts">
	let { children } = $props();
</script>

<div class="mx-auto min-h-[50vh] sm:max-w-3xl max-w-sm px-5 text-left">
	{@render children()}
</div>
