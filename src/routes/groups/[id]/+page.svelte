<script lang="ts">
	import { Button, Card } from 'flowbite-svelte';
	import { enhance, applyAction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { UsersGroupOutline } from 'flowbite-svelte-icons';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="mx-auto max-w-md px-4 py-12">
	<Card class="p-6 text-center space-y-4">
		<UsersGroupOutline class="mx-auto h-12 w-12 text-accent" />
		<h1 class="text-xl font-bold text-tinte-900">{texts.groups.joinPublicTitle}</h1>

		{#if form?.joined}
			<CustomAlert
				type="success"
				message={form.alreadyMember
					? texts.groups.joinAlready(data.group?.name ?? '')
					: texts.groups.joinedPublic(data.group?.name ?? '')}
			/>
			<a
				href={resolve('/user/groups')}
				class="inline-block w-full rounded-lg bg-primary-200 hover:bg-primary px-4 py-2 text-center font-medium"
			>
				{texts.groups.goToGroups}
			</a>
		{:else if data.state === 'valid' && data.group}
			<p class="text-tinte-700">{texts.groups.joinPublicIntro(data.group.name)}</p>
			{#if data.group.description}
				<p class="whitespace-pre-line text-sm text-tinte-500">{data.group.description}</p>
			{/if}

			{#if form?.fail}
				<CustomAlert type="error" message={form?.message} />
			{/if}

			<form
				method="POST"
				action="?/join"
				use:enhance={() => async ({ result }) => {
					// Show the success card instead of letting the default invalidateAll
					// re-run load(), which would redirect (the user is now a member).
					await applyAction(result);
				}}
			>
				<Button type="submit" class="bg-primary-200 hover:bg-primary min-button w-full">
					{texts.groups.joinPublic}
				</Button>
			</form>
		{:else}
			<CustomAlert type="error" message={texts.groups.invalidInvite} />
			<a href={resolve('/search')} class="text-accent hover:underline">{texts.nav.search}</a>
		{/if}
	</Card>
</div>
