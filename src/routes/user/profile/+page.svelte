<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';
	import { Button } from 'flowbite-svelte';
	import { enhance } from '$app/forms';
	import VerifiedIcon from '$lib/components/VerifiedIcon.svelte';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import InviteLink from './InviteLink.svelte';
	import MessengerField from './MessengerField.svelte';
	import NotificationSettings from './NotificationSettings.svelte';


	let { data, form } = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- HEADER -->
<div class="px-4 mx-auto max-w-7xl">
	<div class="mx-auto max-w-screen-sm text-center">
		<h2
			class="text-2xl tracking-tight font-extrabold text-gray-900 dark:text-white"
		>
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
			<form method="POST" action="?/saveProfile" enctype="multipart/form-data" class="space-y-4" use:enhance={() => ({ update }) => update({ reset: false })}>
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
						class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
				<legend class="sr-only">Profilinformationen (schreibgeschützt)</legend>
				
				<!-- Profile Image Field -->
				<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 border-t pt-4">
					<label for="profileImage" class="sm:w-36 sm:shrink-0 sm:pt-2 text-sm font-medium text-tinte-900 dark:text-white">
						{texts.pages.profile.profileImageLabel}
					</label>
					<div class="sm:flex-1 space-y-2">
						{#if data.currentUser.profileImage}
							<div class="flex items-center gap-3">
								<img
									src={`${data.PB_URL}api/files/users/${data.currentUser.id}/${data.currentUser.profileImage}`}
									alt=""
									class="h-16 w-16 rounded-full object-cover"
								/>
							<button
									type="submit"
									form="delete-profile-image-form"
									class="text-sm text-accent-600 hover:text-accent-800 hover:underline cursor-pointer"
								>
									Foto löschen
								</button>
							</div>
						{/if}
						<input
							type="file"
							name="profileImage"
							id="profileImage"
							accept="image/*"
							class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
						/>
					</div>
				</div>

				<!-- Bio Field -->
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
						placeholder="Stelle dich kurz vor..."
					></textarea>
				</div>

				<!-- Submit Button -->
				<div class="pt-4 justify-end flex">
					<Button class="min-button bg-primary-200 hover:bg-primary" type="submit">
						{texts.buttons.save}
					</Button>
				</div>
			</form>
			<!-- Standalone form for profile image deletion — button references this via form="delete-profile-image-form" -->
			<form id="delete-profile-image-form" method="POST" action="?/deleteProfileImage" use:enhance></form>
			<!-- Email Field -->
			<div class="pt-2 mt-2 border-t">
				<label
					for="email"
					class="block text-sm font-medium text-gray-900 dark:text-white mb-2"
				>
					{texts.ui.emailAddress}
					<span
						class="rounded-lg text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
					>
						{data.currentUser.email}
					</span>
					<span class="text-sm text-gray-600 dark:text-gray-400">
						(<a
							href={resolve('/user/profile/updatemail')}
							class="font-medium text-primary hover:underline">ändern</a
						>)
					</span>
				</label>
			</div>
			<!-- Email Verification Status -->
			{#if data.currentUser.verified}
				<p class="flex items-center gap-2 text-sm text-green-600 font-medium mt-2">
					<VerifiedIcon class="h-4 w-4" />
					{texts.pages.profile.emailVerified}
				</p>
			{:else}
				<div class="mt-2 space-y-2">
					<p class="text-sm text-accent-600 dark:text-accent-400">
						{texts.pages.profile.emailNotVerified}
					</p>
					<form method="POST" action="?/resendVerification" use:enhance>
						<button
							type="submit"
							class="text-sm font-medium text-primary hover:text-primary-800 hover:underline cursor-pointer dark:text-primary-400 dark:hover:text-primary-300"
						>
							{texts.pages.profile.resendVerification}
						</button>
					</form>
				</div>
			{/if}

		
		</div>
	</div>
	
	<NotificationSettings />
	
	<InviteLink inviteUrl={data.inviteUrl} />
</main>
