<script>
	import screenshot_search from '$lib/images/screenshot_search.png';
	import screenshot_upload from '$lib/images/screenshot_upload.png';
	import screenshot_trust from '$lib/images/screenshot_trust.png';
	import screenshot_request from '$lib/images/screenshot_request.png';
	import placeholderimg from '$lib/images/placeholder_img.png';
	import HowToElement from './HowToElement.svelte';
</script>

<div class="mx-auto max-w-4xl px-4 py-8">
	<div class="mb-8">
		<h2 class="text-2xl font-semibold tracking-tight">So funktioniert AllerLeih</h2>
		<p class="mt-2 text-base leading-relaxed text-gray-600">
			Allerleih ist eine offene Plattform, auf der du Dinge aus- und verleihen kannst. Im Gegensatz
			zu anderen Plattformen steht bei uns allerdings die Gemeinnützigkeit im Sinne der sozialen und
			ökologischen Wirkung im Vordergrund.
		</p>
		<p class="mt-2 text-base leading-relaxed">
			<strong>Und so funktioniert's:</strong>
		</p>
	</div>

	<div class="grid gap-6">
		<!-- (1) -->
		<HowToElement
			img={screenshot_search}
			number={1}
			headline="Dinge finden"
			text="Auf AllerLeih findest du alle möglichen Dinge aus deiner Umgebung. 
			Mit der Suche kannst du sehen, was verfügbar ist. AllerLeih bündelt für dich das gesamte Angebot aus deiner Umgebung: nicht nur von
                            Bekannten, sondern auch von Leihläden, Bibliotheken, Lastenradstationen oder
                            lokalen Verleihen."
		/>

		<HowToElement
			img={screenshot_request}
			number={2}
			headline="Kontakt aufnehmen"
			text="Du kannst direkt über die Plattform Kontakt zu den Verleiher:innen aufnehmen.
			Falls die Person andere Kontaktdaten wie z.B. von Signal hinterlegt hat, kannst du sie auch darüber kontaktieren."
		/>

		<HowToElement
			img={screenshot_upload}
			number={3}
			headline="Dinge verleihen"
			text="Du besitzt Dinge, die du verleihen magst? Dann lade sie einfach in deinem Profil hoch.
			Versehe sie mit ein paar nützlichen Infos, und fertig!"
		/>

		<HowToElement
			img={screenshot_trust}
			number={4}
			headline="Vertrauen aussprechen"
			text="Dieses oder jenes ist dir so lieb, dass du es nicht an jede:n verleihen würdest?
			Kein Problem!
			Auf AllerLeih kannst du festlegen, dass du bestimmte Dinge nur an dir vertraute
			Personen verleihen willst.
			Das kannst du für jeden deiner Gegenstände beim Hochladen oder im Nachhinein
			festlegen."
		/>

		<HowToElement
			img={placeholderimg}
			number={5}
			headline="Datenschutz"
			text="Du gibst Preis, so viel du magst. Wir sorgen dafür, dass deine Daten sicher und
									vertraulich sind.
									Auf deinem Profil kannst du selber entscheiden, ob du nur deine Stadt, oder direkt
									deine Adresse und Kontaktdaten hinterlegen willst.
									Wir zeigen deine Adresse nie öffentlich – sie wird nur genutzt, um die grobe
									Distanz zu berechnen. Und du kannst jedes Mal entscheiden, ob du sie mit einer
									Anfrage teilen willst."
		/>

	</div>
</div>
