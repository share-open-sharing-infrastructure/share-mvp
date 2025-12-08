<script lang="ts">
    let { children } = $props();
</script>

<div class="mx-auto max-w-3xl text-center min-h-[50vh] px-20">
    {@render children()}
</div>