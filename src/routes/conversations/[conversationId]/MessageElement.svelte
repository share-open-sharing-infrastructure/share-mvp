<script lang="ts">
	import { formatTimestamp } from '$lib/utils/utils';
	import type { Message } from '$lib/types/models';

	// `isSent` is an explicit boolean the caller derives (`message.from === currentUser.id`)
	// — previously this component took the current user's id and called it
	// `isFromCurrentUser`, then compared it internally, which reads like a boolean but was
	// actually an id.
	let { message, isSent }: { message: Message; isSent: boolean } = $props();
</script>

<div
	class="mt-0.5 max-w-[75%] px-3.5 py-2.5 text-sm wrap-break-word
		{isSent
		? 'self-end bg-primary text-white rounded-2xl rounded-br-sm shadow-sm'
		: 'self-start bg-white dark:bg-tinte-700 text-tinte-900 dark:text-white border border-tinte-100 dark:border-tinte-600 rounded-2xl rounded-bl-sm'}"
>
	{message.messageContent}
	<div class="text-[10px] mt-1 text-right
		{isSent ? 'text-white/70' : 'text-tinte-400 dark:text-tinte-400'}">
		{formatTimestamp(message.created, false)}
	</div>
</div>
