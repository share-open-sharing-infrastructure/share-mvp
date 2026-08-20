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

export const instanceContent = {
	faq: {

		whoWeAre:
			'Wir sind der AllerLeih e.V. aus Lüneburg und wollen mit dieser Plattform einen Beitrag zum Gemeinwohl leisten. Im Team sind aktuell Timo, Rocho, Falk, Julia, Madita, Christian und Matteo. Wir sind der Auffassung, dass das Teilen und Leihen in vielerlei Hinsicht eine bessere Alternative zum Kaufen ist. Und wir wollen, dass die Infrastruktur dafür nicht nur einfach und zugänglich ist, sondern auch nachhaltig für alle funktioniert. Deswegen entwickeln wir AllerLeih als gemeinnützige Organisation und Open-Source-Software. So verhindern wir die Kommerzialisierung und manipulative Algorithmen.',
	},
};
