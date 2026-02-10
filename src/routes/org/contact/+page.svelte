<script>
	import { MAIN_CONTACT_MAIL } from '$lib/names';
	import { texts } from '$lib/texts';
</script>

<h1 class="mb-4 text-2xl font-bold">{texts.pages.contact.title}</h1>
Bei Fragen, Anregungen oder oder sonstigen Anliegen erreichst du uns unter folgender
{texts.forms.email}
<a href="mailto:{MAIN_CONTACT_MAIL}" class="underline">{MAIN_CONTACT_MAIL}</a>
