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
        w-10
        rounded-full
        text-lg
        shadow-lg focus:ring-4
        focus:ring-gray-300					
    ">
    +
</Button>