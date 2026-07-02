<script lang="ts">
	interface Props {
		title: string;
		description?: string;
		type?: string;
		canonical?: string;
		image?: string;
		robots?: string;
	}

	let { title, description, type = 'website', canonical, image, robots }: Props = $props();
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
	{#if canonical}
		<link rel="canonical" href={canonical} />
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
