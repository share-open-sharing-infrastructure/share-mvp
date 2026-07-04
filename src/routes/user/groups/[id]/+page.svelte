<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { ArrowLeftOutline, CogOutline, UsersGroupOutline } from 'flowbite-svelte-icons';
	import GroupItemsSection from './GroupItemsSection.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const navLinkClass =
		'inline-flex items-center gap-1.5 rounded-lg border border-tinte-300 bg-papier px-4 py-2 text-sm font-medium text-tinte-700 transition-colors hover:border-primary hover:text-primary dark:border-tinte-600 dark:bg-tinte-800 dark:text-tinte-200 dark:hover:border-primary dark:hover:text-primary';
</script>

<div class="mx-auto max-w-5xl px-4 py-6 space-y-6">
	<a href={resolve('/user/groups')} class="inline-flex items-center text-sm text-accent hover:underline">
		<ArrowLeftOutline class="me-1 h-4 w-4" />{texts.groups.pageTitle}
	</a>

	<div class="space-y-4 text-center">
		<h1 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">{data.group.name}</h1>
		{#if data.group.description}
			<p class="mx-auto max-w-2xl whitespace-pre-line text-tinte-700 dark:text-tinte-300">{data.group.description}</p>
		{/if}
		<div class="flex flex-wrap justify-center gap-2">
			<a href={resolve(`/user/groups/${data.group.id}/mitglieder`)} class={navLinkClass}>
				<UsersGroupOutline class="h-4 w-4" />{texts.groups.members}
			</a>
			{#if data.isOwner}
				<a href={resolve(`/user/groups/${data.group.id}/einstellungen`)} class={navLinkClass}>
					<CogOutline class="h-4 w-4" />{texts.groups.settings}
				</a>
			{/if}
		</div>
	</div>

	<GroupItemsSection items={data.items} pbImgUrl={data.PB_IMG_URL} />
</div>
