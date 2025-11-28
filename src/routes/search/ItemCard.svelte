<script lang="ts">
	import type { Item } from "$lib/types";
	import { Card, Img } from "flowbite-svelte";

    export let item: Item;
    export let imgUrl: string;
</script>

<Card>
    <div class="m-6">
        <Img
            src={imgUrl}
            alt="item image"
            class="mx-auto h-48 w-full rounded-md object-cover p-5"
        />

        <h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {item.name}
        </h5>
        <p class="mt-2 mb-2 text-xs leading-tight font-thin text-gray-400 dark:text-gray-400">
            {item.place}
        </p>
        <p class="mb-3 text-base leading-normal font-normal text-gray-700 dark:text-gray-400">
            {item.description}
        </p>
        <div class="flex space-x-10 sm:mt-0">
            <p class="mb-3 text-xs leading-tight font-thin text-gray-400 dark:text-gray-400">
                Hinzugefügt am: {new Date(item.created).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit'
                })}
            </p>
        </div>
        <div>
            <!-- TODO: Once the database relation is renamed from field to "owner" or sth, rename -->
            <p class="mb-3 text-xs leading-tight font-thin text-gray-400 dark:text-gray-400">
                von {item.expand?.field?.username}
                <a href="/chat/{item.expand?.field?.id}">
                    (kontaktieren)
                </a>
            </p>
        </div>
    </div>
</Card>