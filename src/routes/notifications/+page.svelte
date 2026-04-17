<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { formatTimestamp } from '$lib/utils/utils';
	import { BellOutline, EnvelopeOutline, UserAddOutline } from 'flowbite-svelte-icons';
	import type { Notification } from '$lib/types/models.js';

	let { data } = $props();

	function notificationHref(n: Notification): string {
		if (n.type === 'new_message' || n.type === 'new_request') {
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
				<li>
					<a
						href={notificationHref(notification)}
						class="flex items-start gap-4 py-4 hover:bg-papier rounded-lg px-2 transition-colors"
					>
						<div class="mt-0.5 shrink-0 text-accent">
							{#if notification.type === 'new_message'}
								<EnvelopeOutline class="h-5 w-5" />
							{:else if notification.type === 'new_request'}
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
						{#if !notification.read}
							<div class="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0"></div>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
