<script lang="ts">
	import { UserCircleSolid } from 'flowbite-svelte-icons';
	let chatPartner = $props();
</script>

<li
	class="
	border-t
	p-2
	hover:bg-primary-100"
>
	<a href="/chat/{chatPartner.id}" class="flex">
		<div id="icon" class="p-1">
			<UserCircleSolid class="h-6 w-6 shrink-0" />
		</div>
		<div id="username" class="overflow-hidden p-1 text-ellipsis">
			{chatPartner.username}
		</div>
	</a>
</li>
