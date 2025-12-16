<script lang="ts">
    import { Button } from 'flowbite-svelte';

    let { onclick } = $props();
</script>

<Button
    class="
        w-full
        border
        bg-gray-800
        p-1 text-white 
        hover:bg-gray-900
        focus:ring-4 focus:ring-gray-300 focus:outline-none 
        dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
    {onclick}
>
    Bearbeiten
</Button>