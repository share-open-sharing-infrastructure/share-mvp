<script lang="ts">
	import { formatTimestamp } from '$lib/utils/utils';
	let { message, isFromCurrentUser } = $props();
</script>

<div
	class="
    {message.from === isFromCurrentUser ? 'self-end' : 'self-start'}
    mt-1 max-w-5/6
    rounded-[15px] border p-1
    px-2 text-sm
    wrap-break-word"
>
	{message.messageContent}
	<div class="text-right text-xs text-gray-500">
		{formatTimestamp(message.created, false)}
	</div>
</div>
