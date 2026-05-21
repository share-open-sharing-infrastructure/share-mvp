<script lang="ts">
	import { page } from '$app/state';
	import { texts } from '$lib/texts';

	let { data } = $props();

	const origin = $derived(page.url.origin);
	const registerUrl = $derived(`/auth/register?invite=${data.slug}`);
	const ogTitle = 'Du wurdest zu AllerLeih eingeladen!';
	const ogDescription = texts.pages.inviteLanding.description;
</script>

<svelte:head>
	<title>{data.inviterName ? texts.pages.inviteLanding.title(data.inviterName) : ogTitle}</title>
	<meta property="og:title" content={ogTitle} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:image" content="{origin}/og-invite.png" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{origin}/invite/{data.slug}" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:description" content={ogDescription} />
	<meta name="twitter:image" content="{origin}/og-invite.png" />
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

		<a
			href={registerUrl}
			class="block w-full min-button rounded-full bg-primary-200 px-5 py-3 text-center text-base font-medium text-white hover:bg-primary focus:outline-none focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700 dark:focus:ring-primary-800"
		>
			{texts.pages.inviteLanding.cta}
		</a>
	</div>
</div>
