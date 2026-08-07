<script lang="ts">
	import { page } from '$app/state';
	import { instanceUrl } from '$lib/instance';

	interface Props {
		title: string;
		description?: string;
		type?: string;
		/**
		 * Opt-in canonical link, derived from the current page's own URL — never a path handed
		 * in by the caller. A `canonicalPath?: string` prop built from `resolve()` looked right
		 * (issue #473 round 4) but was fundamentally broken: `svelte.config.js` has no `paths`
		 * block, so SvelteKit's default `paths.relative: true` applies, and `resolve()` returns a
		 * *page-relative* path during SSR (`'./'` for `/`, `'../misc/imprint'` for a nested
		 * route) — `instanceUrl(resolve(...))` then produced malformed canonical/`og:url` tags
		 * (`https://allerleih.org../misc/imprint`) in the raw server-rendered HTML. It looked
		 * fine in a browser only because the client recomputes a correct-looking value after
		 * hydration, masking the bug (and triggering a `hydration_attribute_changed` warning).
		 * `page.url.pathname` (from `$app/state`) is root-absolute and identical on server and
		 * client, and the canonical URL of a page *is* its own URL — so there is nothing to pass
		 * in. Kept opt-in (default `false`) so `robots="noindex"` pages don't silently gain one.
		 */
		canonical?: boolean;
		image?: string;
		robots?: string;
	}

	let { title, description, type = 'website', canonical = false, image, robots }: Props = $props();

	const canonicalHref = $derived(canonical ? instanceUrl(page.url.pathname) : undefined);
</script>

<svelte:head>
	<title>{title}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
	<meta property="og:title" content={title} />
	{#if description}
		<meta property="og:description" content={description} />
	{/if}
	<meta property="og:type" content={type} />
	{#if image}
		<meta property="og:image" content={image} />
	{/if}
	{#if canonicalHref}
		<link rel="canonical" href={canonicalHref} />
	{/if}
	{#if image}
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={title} />
		{#if description}
			<meta name="twitter:description" content={description} />
		{/if}
		<meta name="twitter:image" content={image} />
	{/if}
	{#if robots}
		<meta name="robots" content={robots} />
	{/if}
</svelte:head>
