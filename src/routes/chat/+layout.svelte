<script lang="ts">
	import { Section } from 'flowbite-svelte-blocks';
	import { List, Li } from 'flowbite-svelte';
	import { UserCircleSolid } from 'flowbite-svelte-icons';
	const { data, children } = $props();
</script>

<Section>
	<div class="m-2 flex items-center justify-center">
		<span class="text-2xl font-semibold text-gray-900 dark:text-white"> Chats </span>
	</div>

	<div class="flex flex-col items-center justify-center">
		<!-- Main chat window container including chat list and messages -->
		<div id="chat-window-container" class="flex h-120 w-full max-w-4xl flex-col">
			<!-- Contains both the chat list and the messages window -->
			<!-- TODO: Pull down into the per-user route? -->
			<div id="chat-container" class="flex overflow-hidden">
				<!-- List of all users the present user chatted with -->
				<div id="chat-list" class="w-1/3 overflow-auto border-r p-4">
					<List class="list-none">
						{#each data.chatPartners as chatPartner}
							<Li>
								<a
									href="/chat/{chatPartner.id}"
									class="block flex border-t p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
								>
									<div class="p-1">
										<UserCircleSolid class="h-6 w-6 shrink-0" />
									</div>
									<div class="overflow-hidden p-1">
										{chatPartner.username}
									</div>
								</a>
							</Li>
						{/each}
					</List>
				</div>

				<!-- Chat window showing messages and input field -->
				<div id="chat-window" class="flex w-2/3 flex-col p-4">
					{@render children()}
				</div>
			</div>
		</div>
	</div>
</Section>
