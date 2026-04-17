<script lang="ts">
	import { formatTimestamp } from '$lib/utils/utils';
	let { message, isFromCurrentUser } = $props();

	const isSent = $derived(message.from === isFromCurrentUser);
</script>

<div
	class="mt-1 max-w-4/5 px-3 py-2 text-sm wrap-break-word
		{isSent
		? 'self-end bg-primary-100 text-gray rounded-2xl rounded-br-sm'
		: 'self-start bg-sand dark:bg-tinte-700 text-tinte-900  rounded-2xl rounded-bl-sm'}"
>
	{message.messageContent}
	<div class="text-[10px] opacity-60 mt-0.5 text-right">
		{formatTimestamp(message.created, false)}
	</div>
</div>
