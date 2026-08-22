/**
 * Canonical definition of the lending state machine. EVERY status list in the frontend
 * comes from here; the backend keeps a deliberate, documented mirror in
 * allerleih-backend pb_hooks/services/account.js (delete guard, = ACTIVE_LENDING_STATES).
 * Adding a status ⇒ HERE + texts.lending.statusLabel + the backend mirror (comment there).
 */

/**
 * The 5 forward steps in lifecycle order. Dead ends: `rejected` (owner declines
 * from `pending`) and `aborted` (abort from `pending`/`accepted`, #373).
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
 * Committed/ongoing loan (borrower holds the item or has a pickup arranged).
 * Mirror: backend delete guard. Deliberately WITHOUT `pending` — a mere request
 * is not a loan (e.g. must not block account deletion).
 */
export const ACTIVE_LENDING_STATES = [
	'accepted',
	'active',
	'return_requested',
] as const satisfies readonly LendingStatus[];

/**
 * Unfinished: blocks item deletion and counts as an "existing request"
 * (prevents duplicate requests from the same user for the same item). The dead
 * ends `rejected`/`aborted` and `completed` are deliberately NOT open — after
 * those the same user may request again.
 */
export const OPEN_LENDING_STATES = ['pending', ...ACTIVE_LENDING_STATES] as const;

/**
 * States in which a request can be aborted (#373): in `pending` only by the
 * requester (the owner uses reject), in `accepted` by either side. From `active`
 * onward the item is out — no more aborting.
 */
export const ABORTABLE_LENDING_STATES = [
	'pending',
	'accepted',
] as const satisfies readonly LendingStatus[];

/** Type guard instead of `as` casts/`?? ''` tricks at the call sites. */
export function isLendingStatusIn(states: readonly LendingStatus[], value: unknown): boolean {
	return typeof value === 'string' && (states as readonly string[]).includes(value);
}

/**
 * PocketBase filter fragment `(lendingStatus = "a" || lendingStatus = "b" || …)`.
 * Deliberately safe WITHOUT pb.filter parameters: the values come exclusively from
 * the compile-time constants above, never from user input — dynamic values (itemId,
 * requesterId, …) still go through pb.filter at the call sites.
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
 * UI-only rule for showing the "Abort request" button (#373 decision 1) —
 * INTENTIONALLY DIFFERENT from `LENDING_TRANSITIONS.abortRequest`'s server-side rule.
 * The server allows either party to abort in `pending` OR `accepted`
 * (`ABORTABLE_LENDING_STATES`, `role: 'participant'`); the UI additionally hides the
 * button from the OWNER while `pending`, since the owner has a dedicated "Decline"
 * action for that state instead. Do NOT collapse this into `canTransition` — the
 * divergence between the two is deliberate, not a bug to "fix" into one predicate.
 */
export function canAbortUi(status: LendingStatus | undefined, isOwner: boolean): boolean {
	return status === 'accepted' || (status === 'pending' && !isOwner);
}
