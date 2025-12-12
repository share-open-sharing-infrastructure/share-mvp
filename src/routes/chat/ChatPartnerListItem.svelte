<script lang="ts">
	import { UserCircleSolid } from 'flowbite-svelte-icons';
	let chatPartner = $props();
	console.log(chatPartner);
</script>

<li class="hover:bg-orange-50">
	<a href="/chat/{chatPartner.id}" class="flex border-t p-2">
		<div id="icon" class="p-1">
			<UserCircleSolid class="h-6 w-6 shrink-0" />
		</div>
		<div id="username" class="overflow-hidden p-1">
			{chatPartner.username}
		</div>
	</a>
</li>
