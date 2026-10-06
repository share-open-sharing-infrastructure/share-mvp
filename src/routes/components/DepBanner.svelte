<script lang="ts">
	import { texts } from '$lib/texts';
	import Button from '$lib/components/ui/Button.svelte';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import {
		DEP_VOTE_URL,
		depDismissCookie,
		resolveDepBanner,
		type DepBannerState,
		type DepBannerVariant,
	} from '$lib/depBanner';

	// Server-decided state (instance/time/cookie), see depBannerTimeState.
	let { serverState }: { serverState: DepBannerState } = $props();

	// Variant dismissed in this page session (the cookie is what persists it across loads).
	let dismissedVariant = $state<DepBannerVariant | null>(null);

	const variant = $derived(
		resolveDepBanner(serverState, dismissedVariant, page.url.pathname)
	);

	async function dismiss(current: DepBannerVariant) {
		// Strictly functional UI preference (no consent needed). The server reads it in
		// +layout.server.ts so the next SSR already omits the banner (no flash / layout shift).
		document.cookie = depDismissCookie(
			current,
			new Date(),
			location.protocol === 'https:'
		);
		dismissedVariant = current;
		await tick();
		// The focused ✕ disappears with the banner, which would drop focus to <body>. Hand focus to
		// <main> temporarily so keyboard/screen-reader users keep their place (WCAG 2.4.3).
		const main = document.querySelector('main');
		if (!main) return;
		main.setAttribute('tabindex', '-1');
		main.style.outline = 'none';
		main.addEventListener(
			'blur',
			() => {
				main.removeAttribute('tabindex');
				main.style.outline = '';
			},
			{ once: true }
		);
		main.focus();
	}
</script>

{#if variant}
	<!-- In normal document flow on purpose (not fixed/sticky): stays clear of the fixed bottom-right prompts. -->
	<aside
		aria-label={texts.depBanner.ariaLabel}
		class="bg-primary-100 text-primary-800 dark:bg-tinte-800 dark:text-tinte-100"
	>
		<div
			class="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2 sm:items-center"
		>
			<!-- Below `sm` the CTA stacks under the text, so the text gets the full width next to ✕. -->
			<div
				class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
			>
				<div
					class="min-w-0 flex-1 text-sm leading-snug"
					title={texts.depBanner.nameHint}
				>
					{#if variant === 'final'}
						<p class="font-medium">{texts.depBanner.textFinal}</p>
					{:else}
						<p class="font-medium sm:hidden">{texts.depBanner.textShort}</p>
						<p class="hidden font-medium sm:block">{texts.depBanner.text}</p>
					{/if}
					<p class="hidden text-xs sm:block">{texts.depBanner.nameHint}</p>
				</div>

				<Button
					size="sm"
					href={DEP_VOTE_URL}
					target="_blank"
					rel="noopener"
					data-umami-event="dep-banner-cta"
					class="shrink-0 self-start sm:self-auto"
				>
					{texts.depBanner.cta}
				</Button>
			</div>

			<Button
				variant="ghost"
				size="icon"
				aria-label={texts.depBanner.dismissLabel}
				data-umami-event="dep-banner-dismiss"
				onclick={() => dismiss(variant)}
				class="min-h-11 min-w-11 shrink-0"
			>
				<svg
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					aria-hidden="true"
				>
					<path d="M5 5l10 10M15 5L5 15" />
				</svg>
			</Button>
		</div>
	</aside>
{/if}
