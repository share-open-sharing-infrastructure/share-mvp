<script lang="ts">
    import { Section } from 'flowbite-svelte-blocks';

    let { params, data } = $props();
    const { userId } = params;
</script>

<!--

<Section class="flex items-center justify-center">
    <h3>Chat with {userId}</h3>
    <div>
        {#each data.records as record}
            <div class="m-4 p-4 border rounded">
                <p><strong>From:</strong> { record.from }</p>
                <p><strong>To:</strong> { record.to }</p>
                <p>{ record.messageContent }</p>
            </div>
        {/each}
    </div>
    <form>
        <label for="message">Nachricht:</label>
        <input type="text" id="message" name="message" class="border rounded p-2 m-2" />
    </form>
</Section>

-->

