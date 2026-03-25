<script lang="ts">
	import { onMount } from 'svelte';
	import { texts } from '$lib/texts';
	import { BellOutline, MobilePhoneOutline, CloseOutline } from 'flowbite-svelte-icons';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let {
		loggedIn,
		onNotificationGranted,
		installPromptEvent,
	}: {
		loggedIn: boolean;
		onNotificationGranted: () => Promise<void>;
		installPromptEvent: BeforeInstallPromptEvent | null;
	} = $props();

	let showNotifBanner = $state(false);
	let showInstallBanner = $state(false);
	let installManualHint = $state<string | null>(null);

	function isMobileDevice(): boolean {
		return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
	}

	// React when Chrome delivers the install prompt after mount
	$effect(() => {
		if (
			installPromptEvent &&
			isMobileDevice() &&
			!window.matchMedia('(display-mode: standalone)').matches &&
			!localStorage.getItem('pwa-install-dismissed')
		) {
			showInstallBanner = true;
		}
	});

	onMount(() => {
		// ── Notification banner ───────────────────────────────────────────────
		if (
			loggedIn &&
			'Notification' in window &&
			Notification.permission === 'default' &&
			!localStorage.getItem('pwa-notif-dismissed')
		) {
			showNotifBanner = true;
		}

		// ── Install banner (fallback for Firefox / iOS / others) ─────────────
		if (
			!isMobileDevice() ||
			window.matchMedia('(display-mode: standalone)').matches ||
			localStorage.getItem('pwa-install-dismissed')
		) {
			return;
		}

		// If beforeinstallprompt hasn't fired after 3 s, show the manual hint
		const timer = setTimeout(() => {
			if (installPromptEvent) return; // Chrome fired it — handled by $effect
			const ua = navigator.userAgent;
			if (/Firefox/i.test(ua)) {
				installManualHint = texts.pwa.installManualFirefox;
			} else if (/iPhone|iPad/i.test(ua)) {
				installManualHint = texts.pwa.installManualIos;
			} else {
				installManualHint = texts.pwa.installManualGeneric;
			}
			showInstallBanner = true;
		}, 3000);

		return () => clearTimeout(timer);
	});

	// ── Notification handlers ─────────────────────────────────────────────────

	async function enableNotifications() {
		// Must run inside a user gesture — that's the whole point of this banner
		const permission = await Notification.requestPermission();
		showNotifBanner = false;
		if (permission === 'granted') {
			await onNotificationGranted();
		} else {
			// denied or dismissed — don't ask again
			localStorage.setItem('pwa-notif-dismissed', '1');
		}
	}

	function dismissNotifBanner() {
		showNotifBanner = false;
		localStorage.setItem('pwa-notif-dismissed', '1');
	}

	// ── Install handlers ──────────────────────────────────────────────────────

	async function triggerInstall() {
		if (!installPromptEvent) return;
		await installPromptEvent.prompt();
		await installPromptEvent.userChoice;
		showInstallBanner = false;
		localStorage.setItem('pwa-install-dismissed', '1');
	}

	function dismissInstallBanner() {
		showInstallBanner = false;
		localStorage.setItem('pwa-install-dismissed', '1');
	}
</script>

<!-- Notification permission banner — shown first -->
{#if showNotifBanner}
	<div
		class="fixed bottom-10 right-4 z-40 w-72 rounded-xl shadow-lg bg-white border border-gray-200 p-4 flex flex-col gap-3"
	>
		<div class="flex items-start gap-2">
			<BellOutline class="h-5 w-5 text-accent shrink-0 mt-0.5" />
			<p class="text-sm text-gray-700 leading-snug">{texts.pwa.notifBannerText}</p>
		</div>
		<div class="flex gap-2 justify-end">
			<button
				onclick={dismissNotifBanner}
				class="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
			>
				{texts.pwa.notifDismiss}
			</button>
			<button
				onclick={enableNotifications}
				class="text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg px-3 py-1"
			>
				{texts.pwa.notifEnable}
			</button>
		</div>
	</div>

<!-- Install banner — shown only when notification banner is gone -->
{:else if showInstallBanner}
	<div
		class="fixed bottom-10 right-4 z-40 w-72 rounded-xl shadow-lg bg-white border border-gray-200 p-4 flex flex-col gap-3"
	>
		<div class="flex items-start justify-between gap-2">
			<div class="flex items-start gap-2">
				<MobilePhoneOutline class="h-5 w-5 text-accent shrink-0 mt-0.5" />
				<p class="text-sm text-gray-700 leading-snug">{texts.pwa.installBannerText}</p>
			</div>
			<button onclick={dismissInstallBanner} class="text-gray-300 hover:text-gray-500 shrink-0">
				<CloseOutline class="h-4 w-4" />
			</button>
		</div>
		{#if installManualHint}
			<p class="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">{installManualHint}</p>
		{/if}
		<div class="flex gap-2 justify-end">
			{#if !installManualHint}
				<button
					onclick={dismissInstallBanner}
					class="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
				>
					{texts.pwa.installDismiss}
				</button>
			{/if}
			{#if installPromptEvent}
				<button
					onclick={triggerInstall}
					class="text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg px-3 py-1"
				>
					{texts.pwa.installButton}
				</button>
			{/if}
		</div>
	</div>
{/if}
