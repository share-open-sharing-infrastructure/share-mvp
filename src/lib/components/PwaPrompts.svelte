<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { texts } from '$lib/texts';
	import { pwaInstall } from '$lib/stores/pwaInstall.svelte';
	import { BellOutline, MobilePhoneOutline, CloseOutline } from 'flowbite-svelte-icons';

	let {
		loggedIn,
		onNotificationGranted,
	}: {
		loggedIn: boolean;
		onNotificationGranted: () => Promise<void>;
	} = $props();

	const appPath = resolve('/misc/app');

	let showNotifBanner = $state(false);
	let showInstallBanner = $state(false);

	function isMobileDevice(): boolean {
		return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
	}

	// React when Chrome delivers the install prompt after mount
	$effect(() => {
		if (
			pwaInstall.event &&
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

		// Show the banner even if beforeinstallprompt never fires: without the event it
		// just links to /misc/app, where the per-browser install steps live. Give Chrome
		// 3 s to fire first so users there get the one-tap "Installieren" button instead.
		const timer = setTimeout(() => {
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
		try {
			await pwaInstall.prompt();
		} finally {
			dismissInstallBanner();
		}
	}

	function dismissInstallBanner() {
		showInstallBanner = false;
		localStorage.setItem('pwa-install-dismissed', '1');
	}
</script>

<!-- Notification permission banner — shown first -->
{#if showNotifBanner}
	<div
		class="fixed bottom-10 right-4 z-40 w-72 rounded-xl shadow-lg bg-sand border border-tinte-200 p-4 flex flex-col gap-3"
	>
		<div class="flex items-start gap-2">
			<BellOutline class="h-5 w-5 text-accent shrink-0 mt-0.5" />
			<p class="text-sm text-tinte-700 leading-snug">{texts.pwa.notifBannerText}</p>
		</div>
		<div class="flex gap-2 justify-end">
			<button
				onclick={dismissNotifBanner}
				class="text-xs text-tinte-400 hover:text-tinte-600 px-2 py-1"
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

<!-- Install banner — shown only when notification banner is gone and not already on the App page -->
{:else if showInstallBanner && page.url.pathname !== appPath}
	<div
		class="fixed bottom-10 right-4 z-40 w-72 rounded-xl shadow-lg bg-sand border border-tinte-200 p-4 flex flex-col gap-3"
	>
		<div class="flex items-start justify-between gap-2">
			<div class="flex items-start gap-2">
				<MobilePhoneOutline class="h-5 w-5 text-accent shrink-0 mt-0.5" />
				<p class="text-sm text-tinte-700 leading-snug">{texts.pwa.installBannerText}</p>
			</div>
			<button onclick={dismissInstallBanner} class="text-tinte-300 hover:text-tinte-500 shrink-0">
				<CloseOutline class="h-4 w-4" />
			</button>
		</div>
		<div class="flex gap-2 justify-end items-center">
			{#if pwaInstall.canPrompt}
				<a
					href={appPath}
					onclick={dismissInstallBanner}
					class="text-xs text-tinte-400 hover:text-accent px-2 py-1"
				>
					{texts.pwa.installLearnMore}
				</a>
				<button
					onclick={triggerInstall}
					class="text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg px-3 py-1"
				>
					{texts.pwa.installButton}
				</button>
			{:else}
				<a
					href={appPath}
					onclick={dismissInstallBanner}
					class="text-xs font-semibold text-accent hover:underline px-2 py-1"
				>
					{texts.pwa.installManualLink} →
				</a>
			{/if}
		</div>
	</div>
{/if}
