<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { formatTimestamp } from '$lib/utils/utils';
	import { enhance } from '$app/forms';
	import { BellOutline, EnvelopeOutline, UserAddOutline } from 'flowbite-svelte-icons';
	import type { Notification } from '$lib/types/models';
	let { data } = $props();

	const conversationNotificationTypes = new Set([
		'new_message',
		'new_request',
		'request_accepted',
		'request_rejected',
		'handover_confirmed',
		'return_requested',
		'return_confirmed',
	]);

	function notificationHref(n: Notification): string {
		if (conversationNotificationTypes.has(n.type)) {
			return resolve(`/conversations/${n.relatedId}`);
		}
		if (n.type === 'trust_added' || n.type === 'invite_accepted') {
			return resolve(`/users/${n.relatedId}`);
		}
		return resolve('/notifications');
	}
</script>

<svelte:head>
	<title>{texts.notifications.title} – {texts.names.app}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8">
	<h1 class="text-2xl font-semibold mb-6">{texts.notifications.title}</h1>

	{#if data.notifications.length === 0}
		<div class="flex flex-col items-center gap-3 py-16 text-tinte-400">
			<BellOutline class="h-12 w-12" />
			<p>{texts.notifications.empty}</p>
		</div>
	{:else}
		<ul class="divide-y divide-tinte-100">
			{#each data.notifications as notification (notification.id)}
				<li class="flex items-center gap-2 py-4 px-2 rounded-lg hover:bg-papier transition-colors">
					
					<a
						href={notificationHref(notification)}
						class="flex items-start gap-4 flex-1 min-w-0"
						onclick={() => {
							// Fire-and-forget: navigation proceeds immediately while the server
							// marks the notification as read in the background. SvelteKit's
							// client-side routing does not cancel in-flight fetches on navigate.
							if (!notification.read) {
								const fd = new FormData();
								fd.append('id', notification.id);
								fetch('?/markRead', { method: 'POST', body: fd });
							}
						}}
					>
						<div class="mt-0.5 shrink-0 text-accent">
							{#if conversationNotificationTypes.has(notification.type)}
								<EnvelopeOutline class="h-5 w-5" />
							{:else if notification.type === 'trust_added' || notification.type === 'invite_accepted'}
								<UserAddOutline class="h-5 w-5" />
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-sm text-tinte-800 {notification.read ? '' : 'font-semibold'}">
								{notification.body}
							</p>
							<p class="text-xs text-tinte-400 mt-0.5">{formatTimestamp(notification.created)}</p>
						</div>
					</a>
					<form
						method="POST"
						action="?/toggleRead"
						use:enhance={() => ({ update }) => update()}
					>
						<input type="hidden" name="id" value={notification.id} />
						<button
							type="submit"
							class="shrink-0 p-1.5 rounded-full hover:bg-tinte-200 dark:hover:bg-tinte-700 transition-colors cursor-pointer"
							title={notification.read ? texts.notifications.markUnread : texts.notifications.markRead}
						>
							{#if notification.read}
								<div class="h-2 w-2 rounded-full border border-tinte-400"></div>
							{:else}
								<div class="h-2 w-2 rounded-full bg-primary"></div>
							{/if}
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</div>
