/**
 * Instanzspezifischer Erzähl-Content (Issue #474): Gegenstück zu `$lib/instance.ts`, aber für
 * *Prosa* statt für ableitbare Konfigurationswerte (Stadt, Origin, E-Mail, …). `instance.ts`
 * hält Werte, die in ein ansonsten identisches deutsches Textbaustein-Template interpoliert
 * werden (siehe `texts.ts`); dieses Modul hält Strings, deren WORTLAUT selbst instanzspezifisch
 * ist und sich mit keiner Variable ersetzen lässt.
 *
 * Abgrenzungsregel: Müsste sich dieser Text (nicht nur eine Variable darin) ändern, wenn
 * AllerLeih in einer anderen Stadt mit einem anderen Team neu gestartet würde? Wenn ja → hierher.
 * Wenn nur CITY/APP_NAME/eine E-Mail-Adresse in ein ansonsten identisches Template eingesetzt
 * werden muss → bleibt in `texts.ts`, parametrisiert aus `$lib/instance.ts`.
 *
 * Wie bei `$lib/instance`: NIE aus `src/service-worker.ts` importieren (auch wenn dieses Modul
 * aktuell keinen `$env/dynamic/public`-Import hat — die Grenze gilt für den ganzen
 * Instanzkonfigurations-/Content-Bereich, damit sie nicht bei der nächsten Erweiterung reißt).
 */

export const instanceContent = {
	faq: {
		// Gründer-Biografie: Betreiber-Inhalt, bewusst NICHT instanzabhängig — die beiden
		// Gründer haben tatsächlich in Lüneburg studiert; das bliebe wahr für jede Instanz,
		// eine Interpolation von CITY würde den Satz für eine andere Stadt verfälschen.
		whoWeAre:
			'Derzeit sind wir ein Duo: Timo und Matteo! Wir haben beide in Lüneburg studiert und wollen mit AllerLeih einen Beitrag zum Gemeinwohl leisten. Wir sind der Auffassung, dass das Teilen und Leihen in vielerlei Hinsicht eine bessere Alternative zum Kaufen ist. Und wir wollen, dass die Infrastruktur dafür nicht nur einfach und zugänglich ist, sondern auch nachhaltig für alle funktioniert. Deswegen entwickeln wir AllerLeih als gemeinnützige Organisation und Open-Source-Software. So verhindern wir die Kommerzialisierung und manipulative Algorithmen.',
	},
};
