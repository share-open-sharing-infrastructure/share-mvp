<script>
	import { texts } from '$lib/texts';
	import SeoHead from '$lib/components/SeoHead.svelte';

	const { address, registerEntry, legalFields } = texts.pages.imprint;
</script>

<SeoHead
	title={texts.seo.imprint.title}
	description={texts.seo.imprint.description}
	canonical
/>

<h1 class="mb-4 text-2xl font-bold">{texts.pages.imprint.title}</h1>
<ul class="max-w-md list-inside space-y-2">
	<li>{address.name}</li>
	<li>{address.street}</li>
	<li>{address.postalCode} {address.city}, {address.country}</li>
	{#if address.representative}
		<li>{address.representative}</li>
	{/if}
	<li>{texts.names.mainContactMail}</li>
	{#if registerEntry}
		<li>{registerEntry}</li>
	{/if}
	<!-- Weitere Informationen unten nur falls zutreffend in Zukunft:  https://www.anwalt.de/rechtstipps/impressumspflicht-in-deutschland-was-muss-ins-impressum-und-welche-konsequenzen-drohen-241288.html -->
	<li hidden>{legalFields.supervisoryAuthority}</li>
	<li hidden>{legalFields.professionalRegulation}</li>
	<li hidden>{legalFields.vatId}</li>
	<li hidden>{legalFields.disputeResolution}</li>
	<li hidden>{legalFields.management}</li>
</ul>
