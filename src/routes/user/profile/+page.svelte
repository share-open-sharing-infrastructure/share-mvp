<script lang="ts">
	import { resolve } from '$app/paths';
	import { texts } from '$lib/texts';

	import { Button, Label, Toggle, Popover } from 'flowbite-svelte';
	import { QuestionCircleSolid } from 'flowbite-svelte-icons';

	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let inviteCopied = $state(false);

	function copyInviteLink() {
		navigator.clipboard.writeText(data.inviteUrl).then(() => {
			inviteCopied = true;
			setTimeout(() => (inviteCopied = false), 2000);
		});
	}
</script>

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

<main class="bg-white dark:bg-gray-900 min-h-screen">
	<div class="max-w-2xl mx-auto px-4 py-8 sm:py-12">
		<!-- Profile Form Section -->
		<div
			class="bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 p-6 sm:p-8"
		>
			{#if form}
				<div class="mb-6">
					<CustomAlert
						type={form.success ? 'success' : 'error'}
						message={form.message}
					/>
				</div>
			{/if}

			<form method="POST" action="?/saveProfile" class="space-y-6" use:enhance={() => ({ update }) => update({ reset: false })}>
				<!-- Editable Fields Section -->
				<legend class="sr-only">Bearbeitbare Profilinformationen</legend>

				<!-- Username Field -->
				<div>
					<label
						for="username"
						class="block text-sm font-medium text-gray-900 dark:text-white mb-2"
					>
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

				<!-- Location Field -->
				<div>
					<label
						for="city"
						class="block text-sm font-medium text-gray-900 dark:text-white mb-2"
					>
						{texts.ui.location}
					</label>
					<p class="text-sm text-gray-600 dark:text-gray-400 my-2">
						{texts.pages.userProfile.addressNote}
					</p>

					<AddressInput initialValue={data.currentUser.city ?? ''} />
				</div>

				<!-- Messenger Contact Section -->
				<div class="border-t pt-6 mt-6">
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
						{texts.ui.contact}
					</h2>
					<p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
						{texts.messenger.introText}
					</p>

					<!-- Telegram Field -->
					<div>
						<Label class="flex mb-2">
							<span class="block text-sm font-medium text-gray-900 dark:text-white">
								{texts.messenger.telegramUsername}
							</span>
							<button id="telegram-tooltip">
								<QuestionCircleSolid class="ml-1 h-5 w-5" />
								<span class="sr-only">{texts.ui.explainThis}</span>
							</button>
						</Label>
						<input
							type="text"
							name="telegramUsername"
							id="telegramUsername"
							placeholder={texts.messenger.telegramUsernamePlaceholder}
							value={data.currentUser.telegramUsername ?? ''}
							class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
							autocomplete="off"
						/>
						<Label class="flex mt-2">
							<Toggle
								name="telegramVisibleToTrustedOnly"
								checked={data.currentUser.telegramVisibleToTrustedOnly ?? true}
							>
								{texts.messenger.visibleToTrustedOnly}
							</Toggle>
						</Label>
					</div>

					<!-- Signal Field -->
					<div>
						<Label class="flex mb-2">
							<span class="block text-sm font-medium text-gray-900 dark:text-white">
								{texts.messenger.signalLink}
							</span>
							<button id="signal-tooltip">
								<QuestionCircleSolid class="ml-1 h-5 w-5" />
								<span class="sr-only">{texts.ui.explainThis}</span>
							</button>
						</Label>
						<input
							type="text"
							name="signalLink"
							id="signalLink"
							placeholder={texts.messenger.signalLinkPlaceholder}
							value={data.currentUser.signalLink ?? ''}
							class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
							autocomplete="off"
						/>
						<Label class="flex mt-2">
							<Toggle
								name="signalVisibleToTrustedOnly"
								checked={data.currentUser.signalVisibleToTrustedOnly ?? true}
							>
								{texts.messenger.visibleToTrustedOnly}
							</Toggle>
						</Label>
					</div>
				</div>
				<legend class="sr-only">Profilinformationen (schreibgeschützt)</legend>
				<!-- Email Field -->
				<div>
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

				<!-- Submit Button -->
				<div class="pt-4 justify-end flex">
					<Button class="min-button bg-primary" type="submit">
						{texts.buttons.save}
					</Button>
				</div>
			</form>
		</div>
	</div>
</main>

<!-- Invite Link Section -->
<div class="max-w-2xl mx-auto px-4 pb-8">
	<div class="bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-gray-800 dark:border-gray-700 p-6 sm:p-8">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
			{texts.pages.invite.sectionTitle}
		</h2>
		<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
			{texts.pages.invite.description}
		</p>
		<div class="flex gap-2">
			<input
				type="text"
				readonly
				value={data.inviteUrl}
				class="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white truncate"
			/>
			<Button type="button" class="min-button bg-primary shrink-0" onclick={copyInviteLink}>
				{inviteCopied ? texts.pages.invite.copied : texts.pages.invite.copyButton}
			</Button>
		</div>
	</div>
</div>

<!-- Telegram Tooltip Popover -->
<Popover
	triggeredBy="#telegram-tooltip"
	class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
	placement="top-start"
>
	<div class="space-y-2 p-3">
		<h3 class="font-semibold text-gray-900 dark:text-white">
			{texts.messenger.telegramTooltipTitle}
		</h3>
		{texts.messenger.telegramTooltipText}
	</div>
</Popover>

<!-- Signal Tooltip Popover -->
<Popover
	triggeredBy="#signal-tooltip"
	class="w-72 bg-white text-sm font-light text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
	placement="top-start"
>
	<div class="space-y-2 p-3">
		<h3 class="font-semibold text-gray-900 dark:text-white">
			{texts.messenger.signalTooltipTitle}
		</h3>
		{texts.messenger.signalTooltipText}
	</div>
</Popover>
