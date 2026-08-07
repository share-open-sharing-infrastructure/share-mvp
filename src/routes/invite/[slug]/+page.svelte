<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { texts } from '$lib/texts';
	import { instanceUrl } from '$lib/instance';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();

	const registerUrl = $derived(`${resolve('/auth/register')}?invite=${data.slug}`);
	const ogTitle = 'Du wurdest zu AllerLeih eingeladen!';
	const ogDescription = texts.pages.inviteLanding.description;
	const ogImage = instanceUrl('/og-invite.png');
</script>

<svelte:head>
	<title>{data.inviterName ? texts.pages.inviteLanding.title(data.inviterName) : ogTitle}</title>
	<meta property="og:title" content={ogTitle} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={instanceUrl(page.url.pathname)} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:description" content={ogDescription} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
	<div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-gray-800">
		<div class="mb-6 text-center">
			<img src="/favicon.ico" alt="AllerLeih" class="mx-auto mb-4 h-12 w-12" />
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				{data.inviterName
					? texts.pages.inviteLanding.title(data.inviterName)
					: texts.pages.inviteLanding.genericTitle}
			</h1>
		</div>

		<p class="mb-8 text-center text-gray-600 dark:text-gray-300">
			{ogDescription}
		</p>

		<Button href={registerUrl} size="lg" fullWidth>
			{texts.pages.inviteLanding.cta}
		</Button>
	</div>
</div>
