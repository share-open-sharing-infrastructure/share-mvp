<script lang="ts">
	import { linkifySegments } from '$lib/utils/linkify';

	// Plain-text description rendered with clickable http(s) links. Storage stays plain text;
	// this only linkifies at render time. No {@html}: text segments are escaped, and link hrefs
	// are attribute-bound (also escaped by Svelte) — see $lib/utils/linkify. Line breaks come
	// from a `whitespace-pre-line` wrapper on the parent, not from this component.
	let { text }: { text: string } = $props();

	const segments = $derived(linkifySegments(text));
</script>

{#each segments as seg (seg)}{#if seg.type === 'link'}<a
			href={seg.url}
			target="_blank"
			rel="external noopener noreferrer nofollow ugc"
			class="break-all text-accent underline hover:opacity-80">{seg.url}</a
		>{:else}{seg.text}{/if}{/each}
