<script lang="ts">
    let { data } = $props();
</script>

{#if data.chatPartners.length === 0}
    <div class="flex h-full flex-col items-center justify-center">
        <span class="text-gray-500">Du hast noch keine Chats.</span>
        <span class="text-gray-500">Starte ein Gespräch, indem du jemanden anschreibst!</span>
        <span class="text-gray-500">Gehe dazu auf die <a href="/search" class="text-blue-500 underline">Suche</a> und finde einen Gegenstand.</span>
    </div>
{:else}
    <div class="flex h-full flex-col items-center justify-center">
        <span class="text-gray-500">Wähle einen Chat aus der Liste links.</span>
    </div>
{/if}
