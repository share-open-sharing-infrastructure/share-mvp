<script>
	import { texts } from '$lib/texts';
</script>

<svelte:head>
	<title>{texts.seo.contact.title}</title>
	<meta name="description" content={texts.seo.contact.description} />
	<meta property="og:title" content={texts.seo.contact.title} />
	<meta property="og:description" content={texts.seo.contact.description} />
	<meta property="og:type" content="website" />
	<link rel="canonical" href="https://allerleih.org/misc/contact" />
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">{texts.pages.contact.title}</h1>
Für Fragen, Anregungen, Beta-Zugänge oder sonstige Anliegen erreichst du uns unter:
<a href="mailto:{texts.names.mainContactMail}" class="underline"
	>{texts.names.mainContactMail}</a
>
