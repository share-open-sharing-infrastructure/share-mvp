<script lang="ts">
	import { texts } from '$lib/texts';
	import { Accordion, AccordionItem } from 'flowbite-svelte';
</script>

<h1 class="mb-6 text-2xl font-bold">{texts.pages.faq.title}</h1>

<Accordion>
	<AccordionItem>
		{#snippet header()}Was passiert, wenn etwas kaputt geht?{/snippet}
		<p class="text-gray-500 dark:text-gray-400">
			Wir bekommen die Frage häufiger und haben eine vielleicht etwas unbefriedigende Antwort: das, was sonst auch passieren würde.
			Wenn euer Gegenüber eine Haftpflicht hat, greift die. Oder ihr regelt das zwischen euch.
			Wir wollen bewusst keine Sozialtechnik wie Versicherungen oder Ähnliches anbieten, weil wir Vertrauen nicht outsourcen wollen. 
			Über die Vertrauensfunktion habt ihr die volle Kontrolle darüber, an wen ihr verleiht. Alles Weitere liegt bei euch!
		</p>
	</AccordionItem>

	<AccordionItem>
		{#snippet header()}Wer seid ihr?{/snippet}
		<p class="text-gray-500 dark:text-gray-400">
			Derzeit sind wir ein Duo: Timo und Matteo! Wir haben beide in Lüneburg studiert und wollen mit AllerLeih einen Beitrag zum Gemeinwohl leisten.
			Wir sind der Auffassung, dass das Teilen und Leihen in vielerlei Hinsicht eine bessere Alternative zum Kaufen ist.
			Und wir wollen, dass die Infrastruktur dafür nicht nur einfach und zugänglich ist, sondern auch nachhaltig für alle funktioniert.
			Deswegen entwickeln wir AllerLeih als gemeinnützige Organisation und Open-Source-Software. So verhindern wir die Kommerzialisierung und manipulative Algorithmen.
		</p>
	</AccordionItem>

	<AccordionItem>
		{#snippet header()}Wie finanziert ihr euch?{/snippet}
		<p class="text-gray-500 dark:text-gray-400">
			Aktuell finanzieren wir uns aus eigener Tasche und suchen sehr aktiv nach Finanzierungsmöglichkeiten. 
			Matteo ist zudem bis 2027 durch ein Stipendium der Studienstiftung des deutschen Volkes abgesichert.
			Falls ihr Ideen oder Kontakte habt, meldet euch gerne bei uns! Wir sind für alles offen, solange es zu unseren Werten passt.
		</p>
	</AccordionItem>

	<AccordionItem>
		{#snippet header()}Was habt ihr vor?{/snippet}
		<p class="text-gray-500 dark:text-gray-400">
			AllerLeih für alle! Wir wollen AllerLeih zu DER Plattform für das Teilen und Leihen machen. 
			Im Gegensatz zu anderen Plattformen setzen wir dafür auf open-source und versuchen, ein dezentrales Modell zu entwickeln, das nicht von uns abhängt. 
			In Zukunft soll also jeder Mensch in seiner Stadt, seinem Quartier oder seiner Kommune die Möglichkeit haben, eine eigene AllerLeih-Instanz zu betreiben und sich vor Ort um die Community zu kümmern. 
		</p>
	</AccordionItem>

	<AccordionItem>
		{#snippet header()}Was passiert mit meinen Daten?{/snippet}
		<p class="text-gray-500 dark:text-gray-400">
			
			Wir sind noch im Aufbau und es gibt noch Allerlei(h) zu tun, deswegen läuft hier vielleicht noch nicht alles 100% rund. Aber digitale Freiheitsrechte (Persönlichkeitsrecht, Datenschutz, Teilhabe) sind für uns Grundwerte und wir werden AllerLeih so entwickeln, dass ihr die volle Kontrolle über eure Daten habt. Zu jeder Zeit. immer.
		</p>
	</AccordionItem>
</Accordion>
