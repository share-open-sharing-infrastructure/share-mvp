/**
 * Kanonische Definition der Lending-State-Machine. JEDE Status-Liste im Frontend
 * kommt von hier; das Backend hält einen bewussten, dokumentierten Spiegel in
 * allerleih-backend pb_hooks/services/account.js (Lösch-Guard, = ACTIVE_LENDING_STATES).
 * Status ergänzen ⇒ HIER + texts.lending.statusLabel + Backend-Spiegel (Kommentar dort).
 */

/**
 * Die 5 Forward-Schritte in Lifecycle-Reihenfolge. Sackgassen: `rejected` (Owner lehnt
 * aus `pending` ab) und `aborted` (Abbruch aus `pending`/`accepted`, #373).
 */
export const LENDING_LIFECYCLE = [
	'pending',
	'accepted',
	'active',
	'return_requested',
	'completed',
] as const;

export const LENDING_STATUSES = [...LENDING_LIFECYCLE, 'rejected', 'aborted'] as const;

export type LendingStatus = (typeof LENDING_STATUSES)[number];

/**
 * Verbindliche/laufende Leihe (Borrower hält den Gegenstand oder ist verabredet).
 * Spiegel: Backend-Lösch-Guard. Bewusst OHNE `pending` — eine bloße Anfrage ist
 * keine Leihe (darf z. B. Kontolöschung nicht blockieren).
 */
export const ACTIVE_LENDING_STATES = [
	'accepted',
	'active',
	'return_requested',
] as const satisfies readonly LendingStatus[];

/**
 * Unabgeschlossen: blockiert Item-Löschung und zählt als „bestehende Anfrage"
 * (verhindert Doppel-Anfragen desselben Users für dasselbe Item). Die Sackgassen
 * `rejected`/`aborted` und `completed` sind bewusst NICHT offen — danach darf
 * derselbe User erneut anfragen.
 */
export const OPEN_LENDING_STATES = ['pending', ...ACTIVE_LENDING_STATES] as const;

/**
 * Zustände, in denen eine Anfrage abgebrochen werden kann (#373): in `pending`
 * nur durch den Requester (der Owner nutzt Ablehnen), in `accepted` durch beide
 * Seiten. Ab `active` ist der Gegenstand unterwegs — kein Abbruch mehr.
 */
export const ABORTABLE_LENDING_STATES = [
	'pending',
	'accepted',
] as const satisfies readonly LendingStatus[];

/** Type-Guard statt `as`-Casts/`?? ''`-Tricks an den Call-Sites. */
export function isLendingStatusIn(states: readonly LendingStatus[], value: unknown): boolean {
	return typeof value === 'string' && (states as readonly string[]).includes(value);
}

/**
 * PocketBase-Filterfragment `(lendingStatus = "a" || lendingStatus = "b" || …)`.
 * Bewusst OHNE pb.filter-Parameter sicher: die Werte stammen ausschließlich aus den
 * obigen Compile-Time-Konstanten, nie aus User-Input — dynamische Werte (itemId,
 * requesterId, …) laufen an den Call-Sites weiterhin durch pb.filter.
 */
export function lendingStatusFilter(states: readonly LendingStatus[]): string {
	return '(' + states.map((s) => `lendingStatus = "${s}"`).join(' || ') + ')';
}
