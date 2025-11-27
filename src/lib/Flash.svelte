<script lang="ts">
  let { flash, duration = 3000 } = $props();
  let open = $state(true);

  const timer = setTimeout(() => {
    open = false;
  }, duration);

  // clean up on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => clearTimeout(timer));

  const close = () => (open = false);
</script>

{#if open}
  <div class="fixed bottom-4 left-1/2 -translate-x-1/2
    rounded-lg px-4 py-3 text-sm shadow-lg
    text-white {flash.type === 'error' ? 'bg-red-600' : 'bg-green-600'}">
    {flash.message}
    <button class="ml-3 underline" onclick={close}>Close</button>
  </div>
{/if}