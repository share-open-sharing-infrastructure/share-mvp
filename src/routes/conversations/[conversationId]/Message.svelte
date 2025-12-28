<script lang="ts">
	let { message, isFromCurrentUser } = $props();

	function formatTimestamp(timestamp: string) {
		const d = new Date(timestamp);
		const day = d.getDate();
		const month = d.getMonth() + 1; // months are 0-based
		const hours = d.getHours();
		const minutes = d.getMinutes();

		// pad single digits (e.g. 3 → 03)
		const pad = (n: number) => String(n).padStart(2, '0');

		// if today, return only time
		const today = new Date();
		if (d.toDateString() === today.toDateString()) {
			return `${pad(hours)}:${pad(minutes)}`;
		}

		return `${pad(day)}.${pad(month)}. ${pad(hours)}:${pad(minutes)}`;
	}
</script>

<div
	class="
    {message.from === isFromCurrentUser ? 'self-end' : 'self-start'}
    mt-1 max-w-5/6
    rounded border p-1
    px-2 text-sm
    wrap-break-word"
>
	{message.messageContent}
	<div class="text-right text-xs text-gray-500">
		{formatTimestamp(message.created)}
	</div>
</div>
