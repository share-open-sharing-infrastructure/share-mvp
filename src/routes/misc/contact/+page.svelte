<script>
	import { texts } from '$lib/texts';
	import SeoHead from '$lib/components/SeoHead.svelte';
</script>

<SeoHead
	title={texts.seo.contact.title}
	description={texts.seo.contact.description}
	canonical
/>

<h1 class="mb-4 text-2xl font-bold">{texts.pages.contact.title}</h1>
{texts.pages.contact.body}
<a href="mailto:{texts.names.mainContactMail}" class="underline"
	>{texts.names.mainContactMail}</a
>
