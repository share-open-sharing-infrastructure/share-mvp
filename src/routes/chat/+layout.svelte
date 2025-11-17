<script lang="ts">
    let { data, children } = $props();
	import { Section } from 'flowbite-svelte-blocks';
</script>

<div class="flex">
    <div class="left">
        <ul>
            {#each data.chatUserIds as userId}
                <li>
                    - <a href="/chat/{userId}">Chat mit Benutzer {userId}</a>
                </li>
            {/each}
        </ul>
    </div>
    <div class="right">
        lol test
    </div>
</div>

{@render children()}