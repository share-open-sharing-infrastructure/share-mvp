import { instance } from '$lib/instance';

/**
 * Instance-specific prose (Issue #474): Counterpart to `$lib/instance.ts`, but for
 * Prose instead of derived values (city, origin, email, …).
 *
 * Demarcation rule: Would this text change (and not only a variable within it), if
 * AllerLeih would restart in a different city with a new team? 
 * If only CITY/APP_NAME or similar must be changed
 * → stays in `texts.ts`, parameterised in `$lib/instance.ts`.
 *
 * As with `$lib/instance`: never import from `src/service-worker.ts`
 */
const APP_NAME = instance.appName;

export const instanceContent = {
	faq: {
		faqItems: [
			{
				q: 'Wer seid ihr?',
				a: 
					'Wir sind der AllerLeih e.V. aus Lüneburg und wollen mit dieser Plattform einen Beitrag zum Gemeinwohl leisten. \
					Im Team sind aktuell Timo, Rocho, Falk, Julia, Madita, Christian und Matteo. Wir sind der Auffassung, \
					dass das Teilen und Leihen in vielerlei Hinsicht eine bessere Alternative zum Kaufen ist. \
					Und wir wollen, dass die Infrastruktur dafür nicht nur einfach und zugänglich ist, sondern auch nachhaltig \
					für alle funktioniert. Deswegen entwickeln wir AllerLeih als gemeinnützige Organisation und Open-Source-Software. \
					So verhindern wir die Kommerzialisierung und manipulative Algorithmen.',
			},
			{
				q: 'Was passiert, wenn etwas kaputt geht?',
				a: 'Wir bekommen die Frage häufiger und haben eine vielleicht etwas unbefriedigende Antwort: das, was sonst auch passieren würde. Wenn euer Gegenüber eine Haftpflicht hat, greift die. Oder ihr regelt das zwischen euch. Wir wollen bewusst keine Sozialtechnik wie Versicherungen oder Ähnliches anbieten, weil wir Vertrauen nicht outsourcen wollen. Über die Vertrauensfunktion habt ihr die volle Kontrolle darüber, an wen ihr verleiht. Wenn es doch einmal zu größeren Problemen kommt, meldet euch gerne und wir versuchen zu helfen!',
			},
			{
				q: 'Was kostet das?',
				a: `${APP_NAME} kostet dich als Privatperson nichts, und das wird auch so bleiben, denn ${APP_NAME} ist für alle! Wir finanzieren uns aktuell aus eigener Tasche und suchen aktiv nach Finanzierungsmöglichkeiten. Falls ihr Ideen oder Kontakte habt, meldet euch gerne bei uns!`,
			},
			{
				q: 'Was habt ihr vor?',
				a: `${APP_NAME} für alle! Wir wollen ${APP_NAME} zu DER Plattform für das Teilen und Leihen machen. Im Gegensatz zu anderen Plattformen setzen wir dafür auf open-source und versuchen, ein dezentrales Modell zu entwickeln, das nicht von uns abhängt. In Zukunft soll also jeder Mensch in seiner Stadt, seinem Quartier oder seiner Kommune die Möglichkeit haben, eine eigene ${APP_NAME}-Instanz zu betreiben und sich vor Ort um die Community zu kümmern.`,
			},
			{
				q: 'Was passiert mit meinen Daten?',
				a: `Wir sind noch im Aufbau und es gibt noch Allerlei(h) zu tun, deswegen läuft hier vielleicht noch nicht alles 100% rund. Aber digitale Freiheitsrechte (Persönlichkeitsrecht, Datenschutz, Teilhabe) sind für uns unverhandelbare Grundwerte und wir werden ${APP_NAME} so entwickeln, dass ihr die volle Kontrolle über eure Daten habt. Zu jeder Zeit. Für immer. Das heißt: wir verkaufen keine Daten, Daten liegen auf Servern in Deutschland oder maximal der EU, und wir schützen eure Daten bestmöglich. Falls ihr feststellt, dass das nicht der Fall ist, meldet euch gerne sofort bei uns! Wir wollen transparent sein und Fehler schnellstmöglich beheben.`,
			},
		]
	},

	/** The "/misc/about" team roster — real people, so it changes with the instance/team. */
	team: [
		{
			id: 1,
			linkedIn: 'https://www.linkedin.com/in/matteo-ramin/',
			gitHub: 'https://github.com/MaRaMinden',
			src: 'https://avatars.githubusercontent.com/u/7858896?v=4',
			alt: 'Matteo Ramin',
			name: 'Matteo Ramin',
			jobTitle: 'Initiator & Koordinator',
			description: 'Macht irgendwie alles son bisschen!',
		},
		{
			id: 2,
			linkedIn: 'https://www.linkedin.com/in/timo-johner',
			gitHub: 'https://github.com/timojohlo',
			src: 'https://avatars.githubusercontent.com/u/32620814?v=4',
			alt: 'Timo Johner',
			name: 'Timo Johner',
			jobTitle: 'Initiator & Technik-Guru',
			description: 'Ohne den läuft hier kein Server.',
		},
	],
};
