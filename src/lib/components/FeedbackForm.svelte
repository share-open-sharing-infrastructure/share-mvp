<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import CustomAlert from '$lib/components/CustomAlert.svelte';
	import { texts } from '$lib/texts';

	interface Props {
		onsuccess?: () => void;
	}

	let { onsuccess }: Props = $props();

	let successMessage = $state<string | undefined>(undefined);
	let errorMessage = $state<string | undefined>(undefined);

	let device = $state('unknown');
	let viewportSize = $state('');
	let inputType = $state('unknown');

	let browser = $state('unknown');
	let browserVersion = $state('unknown');

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
	class="space-y-2"
	use:enhance={({ formData }) => {
		formData.set('device', device);
		formData.set('viewportSize', viewportSize);
		formData.set('inputType', inputType);
		formData.set('browser', browser);
		formData.set('browserVersion', browserVersion);
		return ({ result }) => {
			if (result.type === 'success') {
				successMessage = texts.success.feedbackSent;
				setTimeout(() => onsuccess?.(), 1500);
			} else if (result.type === 'failure') {
				errorMessage = (result.data?.message as string) ?? texts.errors.feedbackFailed;
			}
		};
	}}
>
	<p>
		Vielen Dank für dein Feedback! Bitte beschreibe kurz, was dich auf dieser
		Seite stört, dir auffällt oder gefällt.
	</p>

	{#if successMessage}
		<CustomAlert type="success" message={successMessage} />
	{/if}
	{#if errorMessage}
		<CustomAlert type="error" message={errorMessage} />
	{/if}

	<textarea
		name="feedbackMessage"
		required
		class="w-full h-48 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
		placeholder="Dein Feedback hier..."
	></textarea>

	<p class="text-sm text-gray-500">
		Das Formular erkennt automatisch die Seite und deinen Gerätekontext. <strong
			>Wir speichern keine personenbezogenen Daten</strong
		>, du gibst also anonymes Feedback. Wenn du direkt mit uns sprechen willst,
		schreibe uns an
		<a href="mailto:allerleih@posteo.de" class="text-blue-500 hover:underline"
			>allerleih@posteo.de</a
		>
	</p>

	<div class="mt-4 flex justify-end">
		<button type="submit" class="px-4 py-2 min-button">
			Feedback absenden
		</button>
	</div>
</form>
