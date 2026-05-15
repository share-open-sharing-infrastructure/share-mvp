<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import { texts } from '$lib/texts';
	import SparkleButton from './SparkleButton.svelte';

	interface Props {
		onsuccess?: () => void;
		pageName: string;
	}

	let { onsuccess, pageName }: Props = $props();

	let successMessage = $state<string | undefined>(undefined);
	let errorMessage = $state<string | undefined>(undefined);
	let submitting = $state(false);
	let device = $state('unknown');
	let viewportSize = $state('');
	let inputType = $state('unknown');
	let browser = $state('unknown');
	let browserVersion = $state('unknown');

	let selectedSeverity = $state<string | null>(null);

const severityOptions = [
		{ value: 'kleinigkeit', label: texts.feedback.severityKleinigkeit },
		{ value: 'nervt', label: texts.feedback.severityNervt },
		{ value: 'blocker', label: texts.feedback.severityBlocker },
	];

	onMount(() => {
		// mobile vs desktop (interaction-based, not UA-based)
		device = window.matchMedia('(pointer: coarse)').matches
			? 'mobile'
			: 'desktop';

		viewportSize = `${window.innerWidth}x${window.innerHeight}`;

		inputType =
			'ontouchstart' in window || navigator.maxTouchPoints > 0
				? 'touch'
				: 'mouse';

		const ua = navigator.userAgent;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const uaData = (navigator as any).userAgentData;

		// 1. Try Client Hints brands (best signal)
		if (uaData?.brands) {
			for (const b of uaData.brands) {
				const brand = b.brand.toLowerCase();

				if (brand.includes('brave')) {
					browser = 'brave';
					browserVersion = b.version;
					return;
				}
				if (brand.includes('opera')) {
					browser = 'opera';
					browserVersion = b.version;
					return;
				}
				if (brand.includes('vivaldi')) {
					browser = 'vivaldi';
					browserVersion = b.version;
					return;
				}
				if (brand.includes('edge')) {
					browser = 'edge';
					browserVersion = b.version;
					return;
				}
				if (brand.includes('chrome') || brand.includes('chromium')) {
					browser = 'chrome';
					browserVersion = b.version;
				}
			}
		}

		// 2. UA heuristics (best-effort, not guaranteed)
		if (ua.includes('Brave')) {
			browser = 'brave';
		} else if (ua.includes('OPR/') || ua.includes('Opera')) {
			browser = 'opera';
		} else if (ua.includes('Vivaldi')) {
			browser = 'vivaldi';
		} else if (ua.includes('Firefox')) {
			browser = 'firefox';
			browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] ?? 'unknown';
			return;
		} else if (ua.includes('Safari') && !ua.includes('Chrome')) {
			browser = 'safari';
			browserVersion = ua.match(/Version\/(\d+)/)?.[1] ?? 'unknown';
			return;
		} else if (ua.includes('Chrome')) {
			browser = 'chrome';
			browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] ?? 'unknown';
		}
	});
</script>

<form
	method="POST"
	action="/?/feedback"
	class="space-y-4"
	use:enhance={({ formData, cancel }) => {
		const likes = (formData.get('feedbackLikes') as string)?.trim();
		const improvements = (formData.get('feedbackMessage') as string)?.trim();
		if (!likes && !improvements) {
			errorMessage = texts.feedback.validationError;
			cancel();
			return;
		}
		errorMessage = undefined;
		submitting = true;
		formData.set('device', device);
		formData.set('viewportSize', viewportSize);
		formData.set('inputType', inputType);
		formData.set('browser', browser);
		formData.set('browserVersion', browserVersion);
		if (selectedSeverity) formData.set('feedbackSeverity', selectedSeverity);
		return ({ result }) => {
			submitting = false;
			if (result.type === 'success') {
				successMessage = texts.success.feedbackSent;
				setTimeout(() => onsuccess?.(), 1500);
			} else if (result.type === 'failure') {
				errorMessage = (result.data?.message as string) ?? texts.errors.feedbackFailed;
			}
		};
	}}
>
	<p class="text-sm text-tinte-600">{texts.feedback.intro}</p>

	{#if successMessage}
		<CustomAlert type="success" message={successMessage} />
	{/if}
	{#if errorMessage}
		<CustomAlert type="error" message={errorMessage} />
	{/if}

	<div class="space-y-1">
		<label for="feedbackLikes" class="block text-sm font-medium text-tinte-700">
			{texts.feedback.likesLabel(pageName)}
		</label>
		<textarea
			id="feedbackLikes"
			name="feedbackLikes"
			rows="3"
			class="w-full p-2 border border-tinte-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
			placeholder={texts.feedback.likesPlaceholder}
		></textarea>
	</div>

	<div class="space-y-1">
		<label for="feedbackMessage" class="block text-sm font-medium text-tinte-700">
			{texts.feedback.improvementsLabel(pageName)}
		</label>
		<textarea
			id="feedbackMessage"
			name="feedbackMessage"
			rows="3"
			class="w-full p-2 border border-tinte-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
			placeholder={texts.feedback.improvementsPlaceholder}
		></textarea>
	</div>

	<div class="space-y-2">
		<p class="text-sm font-medium text-tinte-700">{texts.feedback.severityLabel}</p>
		<div class="flex gap-2 flex-wrap">
			{#each severityOptions as option(option.value)}
				<button
					type="button"
					class="px-3 py-1.5 rounded-full border text-sm transition-colors {selectedSeverity === option.value
						? 'bg-primary-500 border-primary-500 text-white'
						: 'border-tinte-300 text-tinte-600 hover:border-primary-400 hover:text-primary-600'}"
					onclick={() => {
						selectedSeverity = selectedSeverity === option.value ? null : option.value;
					}}
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<p class="text-sm text-tinte-500">
		{texts.feedback.voiceMemoHint}
		<a
			href="https://t.me/matteo_allerleih"
			target="_blank"
			rel="noopener noreferrer"
			class="text-primary-500 hover:underline"
		>
			{texts.feedback.voiceMemoLink}
		</a>
	</p>

	<details class="text-xs text-tinte-400">
		<summary class="cursor-pointer select-none hover:text-tinte-600">
			Welche Daten werden mitgesendet?
		</summary>
		<ul class="mt-1 space-y-0.5 pl-2">
			<li>Seite: <span class="font-mono">{page.url.pathname}</span></li>
			<li>Gerät: {device}</li>
			<li>Bildschirmgröße: {viewportSize}</li>
			<li>Browser: {browser} {browserVersion}</li>
			<li>Eingabe: {inputType}</li>
		</ul>
		<p class="mt-1">
			Keine personenbezogenen Daten — du gibst anonymes Feedback. Für direkten Kontakt:
			<a href="mailto:feedback@allerleih.org" class="hover:underline">feedback@allerleih.org</a>
		</p>
	</details>

	<div class="mt-4 w-full flex justify-center">
		<SparkleButton label="Feedback absenden" type="submit" disabled={submitting} />
	</div>
</form>
