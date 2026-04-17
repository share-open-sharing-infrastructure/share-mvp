<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { Button } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import MessengerField from './MessengerField.svelte';
	import NotificationSettings from './NotificationSettings.svelte';
	import InviteLink from './InviteLink.svelte';

	let { data, form } = $props();
</script>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="text-2xl tracking-tight font-extrabold text-tinte-900 dark:text-white">
			{texts.pages.profile.title}
		</h2>
	</div>
</div>

<main class="bg-secondary-100 dark:bg-tinte-900 min-h-screen">
	<div class="max-w-2xl mx-auto px-4 py-8 sm:py-12">
		<!-- Profile Form Section -->
		<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8">
			{#if form}
				<div class="mb-6">
					<CustomAlert
						type={form.success ? 'success' : 'error'}
						message={form.message}
					/>
				</div>
			{/if}

			<!-- reset: false preserves typed field values after use:enhance processes the submission -->
			<form method="POST" action="?/saveProfile" class="space-y-4" use:enhance={() => ({ update }) => update({ reset: false })}>
				<legend class="sr-only">Bearbeitbare Profilinformationen</legend>

				<!-- Username Field -->
				<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
					<label for="username" class="sm:w-36 sm:shrink-0 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.ui.username}
					</label>
					<input
						type="text"
						name="username"
						id="username"
						value={data.currentUser.username}
						class="w-full sm:flex-1 px-3 py-2 bg-papier border border-tinte-300 rounded-lg text-tinte-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-tinte-700 dark:border-tinte-600 dark:text-white"
						required
					/>
				</div>

				<!-- Location Field — side-by-side on desktop, stacked on mobile -->
				<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
					<label for="city" class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.ui.location}
					</label>
					<div class="sm:flex-1">
						<AddressInput initialValue={data.currentUser.city ?? ''} />
						<p class="text-sm text-tinte-600 dark:text-tinte-400 mb-2">
							{texts.pages.userProfile.addressNote}
						</p>
					</div>
				</div>

				<!-- Messenger Contact Section -->
				<div class="border-t pt-6 space-y-4">
					<h2 class="text-lg font-semibold text-tinte-900 dark:text-white">
						{texts.ui.contact}
					</h2>
					<p class="text-sm text-tinte-600 dark:text-tinte-400">
						{texts.messenger.introText}
					</p>

					<MessengerField
						fieldName="telegramUsername"
						label={texts.messenger.telegramUsername}
						placeholder={texts.messenger.telegramUsernamePlaceholder}
						value={data.currentUser.telegramUsername ?? ''}
						visibilityToggleName="telegramVisibleToTrustedOnly"
						visibilityToggleChecked={data.currentUser.telegramVisibleToTrustedOnly ?? true}
						tooltipId="telegram-tooltip"
						tooltipTitle={texts.messenger.telegramTooltipTitle}
						tooltipText={texts.messenger.telegramTooltipText}
					/>

					<MessengerField
						fieldName="signalLink"
						label={texts.messenger.signalLink}
						placeholder={texts.messenger.signalLinkPlaceholder}
						value={data.currentUser.signalLink ?? ''}
						visibilityToggleName="signalVisibleToTrustedOnly"
						visibilityToggleChecked={data.currentUser.signalVisibleToTrustedOnly ?? true}
						tooltipId="signal-tooltip"
						tooltipTitle={texts.messenger.signalTooltipTitle}
						tooltipText={texts.messenger.signalTooltipText}
					/>
				</div>

				<!-- Email Field (read-only, links to separate change-email page) -->
				<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
					<span class="sm:w-36 sm:shrink-0 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.ui.emailAddress}
					</span>
					<span class="text-sm text-tinte-700 dark:text-tinte-300">
						{data.currentUser.email}
						<span class="text-tinte-500 dark:text-tinte-400">
							(<a href={resolve('/user/profile/updatemail')} class="font-medium text-primary hover:underline">ändern</a>)
						</span>
					</span>
				</div>

				<!-- Submit Button -->
				<div class="pt-4 justify-end flex">
					<Button class="min-button bg-primary" type="submit">
						{texts.buttons.save}
					</Button>
				</div>
			</form>
		</div>
	</div>
	
	<NotificationSettings />
	
	<InviteLink inviteUrl={data.inviteUrl} />
</main>
