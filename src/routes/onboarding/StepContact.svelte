<script lang="ts">
	import { enhance } from '$app/forms';
	import { texts } from '$lib/texts';
	import { Toggle } from 'flowbite-svelte';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		QuestionCircleSolid,
	} from 'flowbite-svelte-icons';

	interface Props {
		onNext: () => void;
		currentUser?: {
			telegramUsername?: string;
			telegramVisibleToTrustedOnly?: boolean;
			signalLink?: string;
			signalVisibleToTrustedOnly?: boolean;
		};
	}

	let { onNext, currentUser }: Props = $props();
	let showTrustInfo = $state(false);

	let errorMessage = $state<string | undefined>(undefined);

	// Issue #613, prophylactic: seed once, then bind: — docs/best-practices.md → "Editable
	// fields: seed-once + bind:, never one-way value=". No bug to reproduce and hence no
	// regression test: the wizard is a client-only stepper ({#if}-gated steps) and this is step 7,
	// so these inputs are never in the SSR HTML today. Fixed anyway so the step stays correct if
	// the wizard ever becomes resumable (e.g. a `?step=` deep link that server-renders it).
	// svelte-ignore state_referenced_locally
	let telegramValue = $state(
		currentUser?.telegramUsername ? `@${currentUser.telegramUsername}` : ''
	);
	// svelte-ignore state_referenced_locally
	let signalValue = $state(currentUser?.signalLink ?? '');
</script>

<div class="space-y-4">
	<h2 class="text-xl font-bold text-tinte-900 dark:text-white text-center">
		{texts.onboarding.contact.title}
	</h2>
	<p class="text-sm text-tinte-600 dark:text-tinte-400 leading-relaxed">
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
					errorMessage =
						(result.data?.message as string) ?? texts.errors.somethingWentWrong;
				}
			}}
	>
		<!-- Telegram -->
		<div>
			<label
				for="telegramUsername"
				class="block text-sm font-medium text-tinte-900 dark:text-white mb-1"
			>
				{texts.messenger.telegramUsername}
			</label>
			<p class="text-xs text-tinte-500 dark:text-tinte-400 mb-2">
				{texts.messenger.telegramTooltipText}
			</p>
			<input
				type="text"
				name="telegramUsername"
				id="telegramUsername"
				bind:value={telegramValue}
				placeholder={texts.messenger.telegramUsernamePlaceholder}
				autocomplete="off"
				class="w-full px-3 py-2 bg-papier border border-tinte-300 rounded-lg text-sm text-tinte-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-tinte-700 dark:border-tinte-600 dark:text-white"
			/>
			<label class="flex items-center gap-2 mt-2 cursor-pointer">
				<Toggle name="telegramVisibleToTrustedOnly" checked={currentUser?.telegramVisibleToTrustedOnly ?? true} />
				<span class="text-sm text-tinte-600 dark:text-tinte-400"
					>{texts.messenger.visibleToTrustedOnly}</span
				>
				<div
					class="flex items-center text-sm font-light text-tinte-500 dark:text-tinte-400"
				>
					<button
						type="button"
						onclick={() => (showTrustInfo = !showTrustInfo)}
					>
						<QuestionCircleSolid class="ml-1 h-full hover:cursor-pointer" />
						<span class="sr-only">{texts.ui.explainThis}</span>
					</button>
				</div>
			</label>
			{#if showTrustInfo}
				<div
					class="rounded-lg border border-tinte-400 bg-primary-100 mt-2 p-3 text-sm text-tinte-500 space-y-1"
				>
					<p class="font-semibold text-tinte-900">Vertrauensfunktion</p>
					<p>
						Wenn du diese Option aktivierst, ist der Messenger-Link nur für deine
						vertrauten Kontakte sichtbar.
					</p>
				</div>
			{/if}
		</div>

		<!-- Signal -->
		<div>
			<label
				for="signalLink"
				class="block text-sm font-medium text-tinte-900 dark:text-white mb-1"
			>
				{texts.messenger.signalLink}
			</label>
			<p class="text-xs text-tinte-500 dark:text-tinte-400 mb-2">
				{texts.messenger.signalTooltipText}
			</p>
			<input
				type="text"
				name="signalLink"
				id="signalLink"
				bind:value={signalValue}
				placeholder={texts.messenger.signalLinkPlaceholder}
				autocomplete="off"
				class="w-full px-3 py-2 bg-papier border border-tinte-300 rounded-lg text-sm text-tinte-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-tinte-700 dark:border-tinte-600 dark:text-white"
			/>
			<label class="flex items-center gap-2 mt-2 cursor-pointer">
				<Toggle name="signalVisibleToTrustedOnly" checked={currentUser?.signalVisibleToTrustedOnly ?? true} />
				<span class="text-sm text-tinte-600 dark:text-tinte-400"
					>{texts.messenger.visibleToTrustedOnly}</span
				>
			</label>
		</div>

		<!-- Notification skeleton (coming soon) -->
		<div class="border-t border-tinte-200 dark:border-tinte-700 pt-4 mt-2">
			<div class="flex items-center justify-between mb-3">
				<h3 class="text-sm font-medium text-tinte-400 dark:text-tinte-500">
					{texts.onboarding.contact.notificationsTitle}
				</h3>
				<span
					class="text-xs bg-tinte-100 dark:bg-tinte-700 text-tinte-400 dark:text-tinte-500 px-2 py-0.5 rounded-full"
				>
					{texts.onboarding.contact.notificationsNote}
				</span>
			</div>
			<div class="space-y-3 opacity-40 pointer-events-none">

				<div class="flex items-center justify-between">
					<span class="text-sm text-tinte-500 dark:text-tinte-400">
						{texts.onboarding.contact.email}
					</span>
					<Toggle disabled checked={false} />
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-2 pt-2">
			<Button type="submit" size="lg" fullWidth>{texts.onboarding.buttons.next}</Button>
			<Button type="submit" variant="ghost" fullWidth>{texts.onboarding.buttons.skip}</Button>
		</div>
	</form>
</div>
