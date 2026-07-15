<script lang="ts">
	import { onMount } from 'svelte';
	import { texts } from '$lib/texts';
	import { pwaInstall } from '$lib/stores/pwaInstall.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import {
		HomeOutline,
		BellOutline,
		MobilePhoneOutline,
		CheckCircleOutline,
		ArrowsRepeatOutline,
	} from 'flowbite-svelte-icons';

	const app = texts.pages.app;

	// Icons for the capability list, in the same order as app.whatIs.features (kept here
	// because texts.ts holds strings only, not components).
	const featureIcons = [
		HomeOutline,
		BellOutline,
		MobilePhoneOutline,
		CheckCircleOutline,
		ArrowsRepeatOutline,
	];

	let detectedPlatform = $state<string | null>(null);
	let isStandalone = $state(false);

	// Best-effort guess of the user's device/browser so we can pre-open the matching
	// install guide. Intentionally coarse — all iOS browsers share WebKit's share-sheet
	// flow, so we key on the platform, not the exact browser build.
	function detectPlatform(): string {
		const ua = navigator.userAgent;
		const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
		const isIOS = /iPhone|iPad|iPod/i.test(ua) || iPadOS;
		const isAndroid = /Android/i.test(ua);
		const isFirefox = /Firefox|FxiOS/i.test(ua);

		if (isIOS) return 'ios';
		if (isAndroid) return isFirefox ? 'android-firefox' : 'android-chrome';
		if (isFirefox) return 'desktop-firefox';
		if (/Chrome|Chromium|Edg|OPR|Brave/i.test(ua)) return 'desktop-chromium';
		return 'other';
	}

	onMount(() => {
		isStandalone = window.matchMedia('(display-mode: standalone)').matches;
		detectedPlatform = detectPlatform();
	});

	const installed = $derived(isStandalone || pwaInstall.installed);
</script>

<SeoHead
	title={texts.seo.app.title}
	description={texts.seo.app.description}
	canonical="https://allerleih.org/misc/app"
/>

<!-- Intro / install call-to-action -->
<section class="py-8">
	<div class="flex flex-col items-center text-center">
		<span class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100">
			<MobilePhoneOutline class="h-8 w-8 text-accent" />
		</span>
		<h1 class="mb-3 text-2xl font-bold text-tinte-900">{app.title}</h1>
		<p class="max-w-xl leading-relaxed text-tinte-500">{app.intro}</p>

		<div class="mt-6">
			{#if installed}
				<p class="flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-2 text-primary-700">
					<CheckCircleOutline class="h-5 w-5 shrink-0" />
					{app.alreadyInstalled}
				</p>
			{:else if pwaInstall.canPrompt}
				<button
					onclick={() => pwaInstall.prompt().catch(() => {})}
					class="rounded-lg bg-accent px-6 py-3 font-semibold text-white shadow-sm hover:bg-accent/90"
				>
					{app.installNow}
				</button>
				<p class="mt-2 text-sm text-tinte-400">{app.installNowHint}</p>
			{:else}
				<p class="text-sm text-tinte-400">{app.followStepsHint}</p>
			{/if}
		</div>
	</div>
</section>

<!-- What a PWA can do -->
<section class="py-8">
	<h2 class="mb-2 text-xl font-semibold text-tinte-900">{app.whatIs.title}</h2>
	<p class="mb-6 text-tinte-500">{app.whatIs.intro}</p>
	<ul class="grid gap-4 sm:grid-cols-2">
		{#each app.whatIs.features as feature, i (feature.title)}
			{@const Icon = featureIcons[i] ?? CheckCircleOutline}
			<li class="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
				<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100">
					<Icon class="h-5 w-5 text-primary-600" />
				</span>
				<div>
					<p class="font-semibold text-tinte-900">{feature.title}</p>
					<p class="mt-0.5 text-sm leading-relaxed text-tinte-500">{feature.text}</p>
				</div>
			</li>
		{/each}
	</ul>
</section>

<!-- Per-device install instructions -->
<section class="py-8">
	<h2 class="mb-2 text-xl font-semibold text-tinte-900">{app.howTo.title}</h2>
	<p class="mb-6 text-tinte-500">{app.howTo.intro}</p>

	<div class="space-y-3">
		{#each app.howTo.platforms as platform (platform.id)}
			{@const isDetected = platform.id === detectedPlatform}
			<details
				open={isDetected}
				class="group overflow-hidden rounded-2xl border {isDetected
					? 'border-accent bg-accent-50'
					: 'border-gray-200 bg-white'}"
			>
				<summary
					class="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 font-semibold text-tinte-900 select-none [&::-webkit-details-marker]:hidden"
				>
					<span class="flex items-center gap-2">
						{platform.label}
						{#if isDetected}
							<span
								class="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase"
							>
								{app.howTo.detectedNote}
							</span>
						{/if}
					</span>
					<span aria-hidden="true" class="text-tinte-400 transition-transform group-open:rotate-180">▾</span>
				</summary>
				<ol class="list-decimal space-y-2 px-5 pb-5 pl-9 text-sm leading-relaxed text-tinte-600">
					{#each platform.steps as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
			</details>
		{/each}
	</div>
</section>

<!-- Why no native app -->
<section class="py-8">
	<div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
		<h2 class="mb-4 text-xl font-semibold text-tinte-900">{app.whyNoNative.title}</h2>
		<div class="space-y-4 leading-relaxed text-tinte-500">
			{#each app.whyNoNative.paragraphs as paragraph (paragraph)}
				<p>{paragraph}</p>
			{/each}
		</div>
	</div>
</section>
