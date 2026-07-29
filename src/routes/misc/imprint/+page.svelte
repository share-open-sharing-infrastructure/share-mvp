<script>
	import { texts } from '$lib/texts';
	import SeoHead from '$lib/components/SeoHead.svelte';

	const { address } = texts.pages.imprint;
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
	<li>{texts.names.mainContactMail}</li>
	<!-- Weitere Informationen unten nur falls zutreffend in Zukunft:  https://www.anwalt.de/rechtstipps/impressumspflicht-in-deutschland-was-muss-ins-impressum-und-welche-konsequenzen-drohen-241288.html -->
	<li hidden>
		Zuständige Aufsichtsbehörde: Falls der Betreiber einer behördlichen Aufsicht
		unterliegt (z. B. Finanzdienstleister, Versicherungsvermittler).
	</li>
	<li hidden>
		Berufsrechtliche Angaben: Für reglementierte Berufe wie Anwälte, Ärzte oder
		Steuerberater (Berufsbezeichnung, Kammer, berufsrechtliche Regelungen).
	</li>
	<li hidden>
		Umsatzsteuer-Identifikationsnummer (falls vorhanden): Nach § 27a UStG.
	</li>
	<li hidden>
		Handelsregistereintrag: Falls das Unternehmen im Handels-, Vereins- oder
		Partnerschaftsregister eingetragen ist (inkl. Registernummer).
	</li>
	<li hidden>
		Hinweis auf die Online-Streitbeilegung (für Online-Shops): Link zur
		EU-Plattform zur Streitbeilegung.
	</li>
	<li hidden>
		GmbH & Co. KG, AG, UG: Angabe der Geschäftsführer oder Vorstandsmitglieder.
	</li>
</ul>
