<script lang="ts">
	import { texts } from '$lib/texts';
	import { Button } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import ProfileImageField from './ProfileImageField.svelte';
	import EmailSection from './EmailSection.svelte';
	import MessengerField from './MessengerField.svelte';
	import NotificationSettings from './NotificationSettings.svelte';
	import InviteLink from './InviteLink.svelte';
	import TransportModeIcon from '$lib/components/TransportModeIcon.svelte';

	type TransportMode = 'foot' | 'bicycle' | 'car';

	let { data, form } = $props();

	let selectedTransportMode = $state<TransportMode>(
		(data.currentUser.preferredTransportMode as TransportMode | undefined) ?? 'bicycle'
	);

	const profileImageUrl = $derived(
		data.currentUser.profileImage
			? `${data.PB_URL}api/files/users/${data.currentUser.id}/${data.currentUser.profileImage}`
			: null
	);
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2 class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white">
			{texts.pages.profile.title}
		</h2>
	</div>
</div>

<main class="bg-secondary-100 dark:bg-tinte-900 min-h-screen">
	<div class="max-w-2xl mx-auto px-4 py-8 sm:py-12">
		<div class="bg-sand border border-tinte-200 rounded-lg shadow-sm dark:bg-tinte-800 dark:border-tinte-700 p-6 sm:p-8">
			{#if form}
				<div class="mb-6">
					<CustomAlert type={form.success ? 'success' : 'error'} message={form.message} />
				</div>
			{/if}

			<!-- reset: false preserves typed field values after use:enhance processes the submission -->
			<form method="POST" action="?/saveProfile" enctype="multipart/form-data" class="space-y-4" use:enhance={() => async ({ update }) => { await update({ reset: false }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
				<!-- Username -->
				<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
					<label for="username" class="sm:w-36 sm:shrink-0 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.ui.username}
					</label>
					<input
						type="text"
						name="username"
						id="username"
						value={data.currentUser.username}
						class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
						required
					/>
				</div>

				<!-- Location -->
				<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
					<label for="city" class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.ui.location}
					</label>
					<div class="sm:flex-1">
						<AddressInput initialValue={data.currentUser.city ?? ''} />
						<p class="text-sm text-tinte-600 dark:text-tinte-400 mb-2 mt-2">
							{texts.pages.userProfile.addressNote}
						</p>
						<p class="text-xs text-tinte-500 dark:text-tinte-400 mb-5">
							{texts.pages.userProfile.addressHint}
						</p>
					</div>
				</div>

				<!-- Transport Mode -->
				<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
					<label class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.pages.profile.transportModeLabel}
					</label>
					<div>
						<div class="flex gap-2">
							<input type="hidden" name="preferredTransportMode" value={selectedTransportMode} />
							{#each (['foot', 'bicycle', 'car'] as TransportMode[]) as mode (mode)}
								<button
									type="button"
									onclick={() => (selectedTransportMode = mode)}
									class="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 transition-colors cursor-pointer
										{selectedTransportMode === mode
										? 'border-primary bg-primary-50 dark:bg-primary-900/20 text-primary dark:text-primary-300'
										: 'border-tinte-200 dark:border-tinte-600 text-tinte-600 dark:text-tinte-300 hover:border-tinte-400 dark:hover:border-tinte-400'}"
								>
									<TransportModeIcon {mode} class="h-5 w-5" />
									<span class="text-xs font-medium">{texts.pages.search.transportModes[mode]}</span>
								</button>
							{/each}
						</div>
						<p class="text-xs text-tinte-500 dark:text-tinte-400 mt-2">
							{texts.pages.profile.transportModeNote}
						</p>
					</div>
				</div>

				<!-- Messenger Contact -->
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

				<!-- Profile Image -->
				<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 border-t pt-4">
					<label for="profileImage" class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.pages.profile.profileImageLabel}
					</label>
					<div class="sm:flex-1">
						<ProfileImageField imageUrl={profileImageUrl} />
					</div>
				</div>
				<!-- Bio -->
				<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
					<label for="bio" class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.pages.profile.bioLabel}
					</label>
					<textarea
						name="bio"
						id="bio"
						rows="4"
						value={data.currentUser.bio ?? ''}
						class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-y"
						placeholder={texts.pages.profile.bioPlaceholder}
					></textarea>
				</div>

				<!-- Submit -->
				<div class="pt-4 justify-end flex">
					<Button class="min-button bg-primary-200 hover:bg-primary" type="submit">
						{texts.buttons.save}
					</Button>
				</div>
			</form>
			<form
				id="delete-profile-image-form"
				method="POST"
				action="?/deleteProfileImage"
				use:enhance={() => ({ update }) => update({ reset: false })}
			></form>

			<EmailSection
				email={data.currentUser.email}
				verified={data.currentUser.verified ?? false}
			/>
		</div>
	</div>

	<NotificationSettings />

	<InviteLink inviteUrl={data.inviteUrl} />
</main>
