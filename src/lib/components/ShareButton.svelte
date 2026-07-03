<script lang="ts">
	import type { Component } from 'svelte';
	import { browser } from '$app/environment';
	import { texts } from '$lib/texts';
	import { Button, Tooltip } from 'flowbite-svelte';
	import { ShareNodesOutline, CheckOutline } from 'flowbite-svelte-icons';

	let {
		url,
		title = texts.names.app,
		shareText,
		label,
		copiedLabel = texts.share.linkCopied,
		icon = ShareNodesOutline,
		class: className = ''
	}: {
		url: string;
		title?: string;
		shareText?: string;
		label?: string;
		copiedLabel?: string;
		icon?: Component;
		class?: string;
	} = $props();

	let copied = $state(false);

	function markCopied() {
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	// Legacy fallback for insecure contexts (e.g. http:// over the LAN in dev),
	// where navigator.clipboard is undefined: select the text in an off-screen
	// field and copy it with the deprecated-but-widely-supported execCommand.
	function legacyCopy(text: string): boolean {
		const field = document.createElement('textarea');
		field.value = text;
		field.setAttribute('readonly', '');
		field.style.position = 'fixed';
		field.style.top = '-1000px';
		field.style.opacity = '0';
		document.body.appendChild(field);
		field.select();
		let ok = false;
		try {
			ok = document.execCommand('copy');
		} catch {
			ok = false;
		}
		document.body.removeChild(field);
		return ok;
	}

	// Prefer the native Web Share API (mobile / PWA / some desktop browsers) so the
	// user can pick any app (WhatsApp, Signal, …). Falls back to clipboard copy on
	// browsers that don't support navigator.share (most desktop browsers).
	async function share() {
		// with shareText the paste is ready-to-send; otherwise just the URL
		const toCopy = shareText ? shareText + url : url;

		if (browser && navigator.share) {
			try {
				await navigator.share({ title, url, ...(shareText ? { text: shareText } : {}) });
			} catch {
				// user cancelled the native share sheet — do nothing
			}
			return;
		}

		// Modern clipboard (requires a secure context: https or localhost)
		if (browser && navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(toCopy);
				markCopied();
				return;
			} catch {
				// fall through to the legacy path below
			}
		}

		// Insecure-context fallback (LAN dev over http://): select + execCommand copy
		if (browser && legacyCopy(toCopy)) {
			markCopied();
		}
	}

	const CurrentIcon = $derived(copied ? CheckOutline : icon);
</script>

{#if label}
	<Button onclick={share} class={className}>
		<CurrentIcon class="h-4 w-4" />
		{copied ? copiedLabel : label}
	</Button>
{:else}
	<button
		type="button"
		onclick={share}
		aria-label={texts.share.button}
		class="text-tinte-500 hover:text-primary dark:text-tinte-400 dark:hover:text-primary transition-colors cursor-pointer"
	>
		<CurrentIcon class="shrink-0 h-7 w-7" />
	</button>
	<Tooltip type="light" placement="top">{copied ? copiedLabel : texts.share.button}</Tooltip>
{/if}
