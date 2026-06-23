<script lang="ts">
	import { Button, Card } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
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
		<h1 class="text-xl font-bold text-tinte-900">{texts.groups.joinTitle}</h1>

		{#if form?.joined}
			<!-- Outcome after pressing "join": clear feedback instead of a silent redirect. -->
			<CustomAlert
				type="success"
				message={form.alreadyMember
					? texts.groups.joinAlready(form.groupName)
					: texts.groups.joinSuccess(form.groupName)}
			/>
			<a
				href={resolve('/user/groups')}
				class="inline-block w-full rounded-lg bg-primary-200 hover:bg-primary px-4 py-2 text-center font-medium"
			>
				{texts.groups.goToGroups}
			</a>
		{:else if data.state === 'valid'}
			<p class="text-tinte-700">{texts.groups.joinInvitedTo(data.groupName)}</p>

			{#if form?.fail}
				<CustomAlert type="error" message={form?.message} />
			{/if}

			{#if data.loggedIn}
				<form method="POST" action="?/join" use:enhance>
					<Button type="submit" class="bg-primary-200 hover:bg-primary min-button w-full">
						{texts.groups.joinButton}
					</Button>
				</form>
			{:else}
				<!-- Preview is public, but joining needs an account. Send guests to
				     login and bring them straight back to this invite. -->
				<a
					href={`${resolve('/auth/login')}?redirectTo=${encodeURIComponent('/groups/join/' + data.token)}`}
					class="inline-block w-full rounded-lg bg-primary-200 hover:bg-primary px-4 py-2 text-center font-medium"
				>
					{texts.groups.loginToJoin}
				</a>
			{/if}
		{:else if data.state === 'expired'}
			<CustomAlert type="error" message={texts.groups.expiredInvite} />
			<a href={resolve('/search')} class="text-accent hover:underline">{texts.nav.search}</a>
		{:else}
			<CustomAlert type="error" message={texts.groups.invalidInvite} />
			<a href={resolve('/search')} class="text-accent hover:underline">{texts.nav.search}</a>
		{/if}
	</Card>
</div>
