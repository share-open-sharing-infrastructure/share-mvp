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

// --- Transition table ---
// Every server-side lending action as data: which role may call it, from which
// status(es), and which status it lands on. `[conversationId]/lending.server.ts`'s
// `executeLendingTransition()` looks entries up here instead of hardcoding the
// role/state guard per function.

/** The 6 server-side mutations exposed as `?/actionName` form actions. */
export const LENDING_ACTIONS = [
	'acceptRequest',
	'rejectRequest',
	'abortRequest',
	'confirmHandover',
	'requestReturn',
	'confirmReturn',
] as const;

export type LendingAction = (typeof LENDING_ACTIONS)[number];

/** Matches `loadAndValidateConversation`'s `requiredRole` parameter. */
export type LendingRole = 'owner' | 'requester' | 'participant';

export interface LendingTransition {
	role: LendingRole;
	from: readonly LendingStatus[];
	to: LendingStatus;
}

export const LENDING_TRANSITIONS: Record<LendingAction, LendingTransition> = {
	acceptRequest: { role: 'owner', from: ['pending'], to: 'accepted' },
	rejectRequest: { role: 'owner', from: ['pending'], to: 'rejected' },
	// Reuses ABORTABLE_LENDING_STATES rather than re-deriving an equivalent state list.
	abortRequest: { role: 'participant', from: ABORTABLE_LENDING_STATES, to: 'aborted' },
	confirmHandover: { role: 'owner', from: ['accepted'], to: 'active' },
	requestReturn: { role: 'requester', from: ['active'], to: 'return_requested' },
	confirmReturn: { role: 'owner', from: ['active', 'return_requested'], to: 'completed' },
};

/**
 * Pure predicate over `LENDING_TRANSITIONS`: could `action` be performed by a caller in
 * `role` given the conversation's `currentStatus`? Mirrors exactly what
 * `loadAndValidateConversation` enforces server-side.
 */
export function canTransition(
	action: LendingAction,
	role: { isOwner: boolean; isRequester: boolean },
	currentStatus: LendingStatus | undefined
): boolean {
	const transition = LENDING_TRANSITIONS[action];
	if (!currentStatus || !isLendingStatusIn(transition.from, currentStatus)) return false;
	if (transition.role === 'owner') return role.isOwner;
	if (transition.role === 'requester') return role.isRequester;
	return role.isOwner || role.isRequester;
}

/**
 * UI-only rule for showing the "Anfrage abbrechen" button (#373 decision 1) —
 * INTENTIONALLY DIFFERENT from `LENDING_TRANSITIONS.abortRequest`'s server-side rule.
 * The server allows either party to abort in `pending` OR `accepted`
 * (`ABORTABLE_LENDING_STATES`, `role: 'participant'`); the UI additionally hides the
 * button from the OWNER while `pending`, since the owner has a dedicated "Ablehnen"
 * action for that state instead. Do NOT collapse this into `canTransition` — the
 * divergence between the two is deliberate, not a bug to "fix" into one predicate.
 */
export function canAbortUi(status: LendingStatus | undefined, isOwner: boolean): boolean {
	return status === 'accepted' || (status === 'pending' && !isOwner);
}
