<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import OnboardingButton from './OnboardingButton.svelte';

	interface Props {
		onNext: () => void;
	}

	let { onNext }: Props = $props();

	let errorMessage = $state<string | undefined>(undefined);
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold text-gray-900 dark:text-white text-center">
		{texts.onboarding.contact.title}
	</h2>
	<p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
		{texts.onboarding.contact.explanation}
	</p>

	{#if errorMessage}
		<CustomAlert type="error" message={errorMessage} />
	{/if}

	<form
		method="POST"
		action="?/complete"
		class="space-y-5 mt-2"
		use:enhance={() =>
			({ result }) => {
				if (result.type === 'success') {
					onNext();
				} else if (result.type === 'failure') {
					errorMessage = (result.data?.message as string) ?? texts.errors.somethingWentWrong;
				}
			}}
	>
		<!-- Telegram -->
		<div>
			<label
				for="telegramUsername"
				class="block text-sm font-medium text-gray-900 dark:text-white mb-1"
			>
				{texts.messenger.telegramUsername}
			</label>
			<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
				{texts.messenger.telegramTooltipText}
			</p>
			<input
				type="text"
				name="telegramUsername"
				id="telegramUsername"
				placeholder={texts.messenger.telegramUsernamePlaceholder}
				autocomplete="off"
				class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			/>
			<label class="flex items-center gap-2 mt-2 cursor-pointer">
				<Toggle name="telegramVisibleToTrustedOnly" checked={true} />
				<span class="text-sm text-gray-600 dark:text-gray-400">{texts.messenger.visibleToTrustedOnly}</span>
			</label>
		</div>

		<!-- Signal -->
		<div>
			<label
				for="signalLink"
				class="block text-sm font-medium text-gray-900 dark:text-white mb-1"
			>
				{texts.messenger.signalLink}
			</label>
			<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
				{texts.messenger.signalTooltipText}
			</p>
			<input
				type="text"
				name="signalLink"
				id="signalLink"
				placeholder={texts.messenger.signalLinkPlaceholder}
				autocomplete="off"
				class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
			/>
			<label class="flex items-center gap-2 mt-2 cursor-pointer">
				<Toggle name="signalVisibleToTrustedOnly" checked={true} />
				<span class="text-sm text-gray-600 dark:text-gray-400">{texts.messenger.visibleToTrustedOnly}</span>
			</label>
		</div>

		<!-- Notification skeleton (coming soon) -->
		<div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-medium text-gray-400 dark:text-gray-500">
					{texts.onboarding.contact.notificationsTitle}
				</h3>
				<span class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 px-2 py-0.5 rounded-full">
					{texts.onboarding.contact.notificationsNote}
				</span>
			</div>
			<div class="space-y-3 opacity-40 pointer-events-none">
				<div class="flex items-center justify-between">
					<span class="text-sm text-gray-500 dark:text-gray-400">
						{texts.onboarding.contact.inApp}
					</span>
					<Toggle disabled checked={false} />
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm text-gray-500 dark:text-gray-400">
						{texts.onboarding.contact.email}
					</span>
					<Toggle disabled checked={false} />
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-2 pt-2">
			<OnboardingButton type="submit">{texts.onboarding.buttons.next}</OnboardingButton>
			<OnboardingButton type="submit" variant="ghost">{texts.onboarding.buttons.skip}</OnboardingButton>
		</div>
	</form>
</div>
