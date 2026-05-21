<script lang="ts">
	import { LockSolid } from 'flowbite-svelte-icons';
	import { Popover } from 'flowbite-svelte';
	import { texts } from '$lib/texts';

	interface Props {
		id: string;
		loggedIn?: boolean;
		isOverflow?: boolean;
		overflowCount?: number;
	}
	let { id, loggedIn = false, isOverflow = false, overflowCount = 0 }: Props = $props();
</script>

<div
	{id}
	class="flex flex-row rounded-lg border border-tinte-200 dark:border-tinte-700 bg-white dark:bg-tinte-800 overflow-hidden min-h-20 cursor-help"
>
	<div class="w-24 md:w-48 max-w-36 shrink-0 self-stretch bg-linear-to-br from-tinte-100 to-tinte-200 dark:from-tinte-700 dark:to-tinte-800 flex flex-col items-center justify-center gap-1 px-1">
		<LockSolid class="h-6 w-6 text-tinte-400 dark:text-tinte-500" />
		{#if isOverflow}
			<span class="text-xs font-medium text-tinte-500 dark:text-tinte-400 text-center leading-tight">
				{texts.pages.userProfile.moreLockedItems(overflowCount)}
			</span>
		{/if}
	</div>
	<div class="p-4 flex items-center">
		<p class="text-sm text-tinte-500 dark:text-tinte-400">{texts.pages.userProfile.lockedCard}</p>
	</div>
</div>

<Popover
	triggeredBy="#{id}"
	trigger="hover"
	class="w-72 bg-papier text-sm font-light text-tinte-500 dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-400"
	placement="top"
>
	<div class="space-y-2 p-3">
		<h3 class="font-semibold text-tinte-900 dark:text-white">
			{texts.pages.userProfile.lockedTooltipTitle}
		</h3>
		<p>{loggedIn ? texts.pages.userProfile.lockedTooltipBody : texts.pages.userProfile.lockedTooltipBodyGuest}</p>
	</div>
</Popover>
