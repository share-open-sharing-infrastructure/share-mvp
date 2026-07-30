import { describe, it, expect } from 'vitest';
import {
	LENDING_LIFECYCLE,
	LENDING_STATUSES,
	LENDING_ACTIONS,
	LENDING_TRANSITIONS,
	ACTIVE_LENDING_STATES,
	OPEN_LENDING_STATES,
	ABORTABLE_LENDING_STATES,
	isLendingStatusIn,
	lendingStatusFilter,
	canTransition,
	canAbortUi,
	type LendingStatus,
} from './lending';
import { texts } from './texts';

describe('lending constants', () => {
	// Case 1: lifecycle order & completeness.
	it('LENDING_LIFECYCLE has exactly the 5 forward steps in order', () => {
		expect(LENDING_LIFECYCLE).toEqual([
			'pending',
			'accepted',
			'active',
			'return_requested',
			'completed',
		]);
	});

	it('LENDING_STATUSES is the 7 statuses without duplicates', () => {
		expect(LENDING_STATUSES).toEqual([
			'pending',
			'accepted',
			'active',
			'return_requested',
			'completed',
			'rejected',
			'aborted',
		]);
		expect(new Set(LENDING_STATUSES).size).toBe(LENDING_STATUSES.length);
		expect(LENDING_STATUSES.length).toBe(7);
	});

	// Case 2: grouping invariants.
	it('groupings relate correctly (ACTIVE ⊂ OPEN, pending ∈ OPEN∖ACTIVE, rejected/aborted/completed ∉ OPEN)', () => {
		for (const s of ACTIVE_LENDING_STATES) {
			expect(OPEN_LENDING_STATES).toContain(s);
		}
		expect(OPEN_LENDING_STATES).toContain('pending');
		expect(ACTIVE_LENDING_STATES as readonly string[]).not.toContain('pending');
		expect(OPEN_LENDING_STATES as readonly string[]).not.toContain('rejected');
		expect(OPEN_LENDING_STATES as readonly string[]).not.toContain('aborted');
		expect(OPEN_LENDING_STATES as readonly string[]).not.toContain('completed');
	});
});

describe('lendingStatusFilter', () => {
	// Case 3: AC filter-string test for OPEN and ACTIVE.
	it('builds the OPEN filter with each OPEN status once and no non-OPEN status', () => {
		const filter = lendingStatusFilter(OPEN_LENDING_STATES);
		expect(filter).toBe(
			'(lendingStatus = "pending" || lendingStatus = "accepted" || lendingStatus = "active" || lendingStatus = "return_requested")'
		);
		for (const s of OPEN_LENDING_STATES) {
			expect(filter.match(new RegExp(`lendingStatus = "${s}"`, 'g'))).toHaveLength(1);
		}
		for (const s of ['rejected', 'aborted', 'completed'] as const) {
			expect(filter).not.toContain(`lendingStatus = "${s}"`);
		}
		// Correctly parenthesised and OR-joined.
		expect(filter.startsWith('(')).toBe(true);
		expect(filter.endsWith(')')).toBe(true);
		expect(filter.split(' || ')).toHaveLength(OPEN_LENDING_STATES.length);
	});

	it('builds the ACTIVE filter with each ACTIVE status once and no pending/rejected/completed', () => {
		const filter = lendingStatusFilter(ACTIVE_LENDING_STATES);
		expect(filter).toBe(
			'(lendingStatus = "accepted" || lendingStatus = "active" || lendingStatus = "return_requested")'
		);
		for (const s of ACTIVE_LENDING_STATES) {
			expect(filter.match(new RegExp(`lendingStatus = "${s}"`, 'g'))).toHaveLength(1);
		}
		for (const s of ['pending', 'rejected', 'aborted', 'completed'] as const) {
			expect(filter).not.toContain(`lendingStatus = "${s}"`);
		}
	});
});

describe('texts.lending.statusLabel', () => {
	// Case 4: labels stay in lockstep with the status set (protects the keyof-typeof lookup).
	it('has exactly one German label per lending status', () => {
		expect(new Set(Object.keys(texts.lending.statusLabel))).toEqual(new Set(LENDING_STATUSES));
	});
});

describe('isLendingStatusIn', () => {
	// Case 5: hit / miss / undefined / '' / garbage / non-string.
	it('returns true for a member status', () => {
		expect(isLendingStatusIn(ACTIVE_LENDING_STATES, 'active')).toBe(true);
		expect(isLendingStatusIn(OPEN_LENDING_STATES, 'pending')).toBe(true);
	});

	it('returns false for a non-member status', () => {
		expect(isLendingStatusIn(ACTIVE_LENDING_STATES, 'pending')).toBe(false);
		expect(isLendingStatusIn(OPEN_LENDING_STATES, 'completed')).toBe(false);
	});

	it('returns false for undefined, empty string, garbage and non-string values', () => {
		expect(isLendingStatusIn(ACTIVE_LENDING_STATES, undefined)).toBe(false);
		expect(isLendingStatusIn(ACTIVE_LENDING_STATES, '')).toBe(false);
		expect(isLendingStatusIn(ACTIVE_LENDING_STATES, 'garbage')).toBe(false);
		expect(isLendingStatusIn(ACTIVE_LENDING_STATES, 42)).toBe(false);
		expect(isLendingStatusIn(ACTIVE_LENDING_STATES, null)).toBe(false);
		expect(isLendingStatusIn(ACTIVE_LENDING_STATES, { s: 'active' })).toBe(false);
	});
});

describe('LENDING_TRANSITIONS', () => {
	it('has exactly one row per LENDING_ACTIONS entry', () => {
		expect(new Set(Object.keys(LENDING_TRANSITIONS))).toEqual(new Set(LENDING_ACTIONS));
	});

	it("reuses ABORTABLE_LENDING_STATES for abortRequest's `from` (not a re-derived equivalent list)", () => {
		expect(LENDING_TRANSITIONS.abortRequest.from).toBe(ABORTABLE_LENDING_STATES);
	});
});

describe('canTransition', () => {
	it('allows the owner to accept a pending request', () => {
		expect(canTransition('acceptRequest', { isOwner: true, isRequester: false }, 'pending')).toBe(true);
	});

	it('denies the requester from accepting their own request', () => {
		expect(canTransition('acceptRequest', { isOwner: false, isRequester: true }, 'pending')).toBe(false);
	});

	it('denies an accept from a non-pending state', () => {
		expect(canTransition('acceptRequest', { isOwner: true, isRequester: false }, 'accepted')).toBe(false);
	});

	it('denies when currentStatus is undefined', () => {
		expect(canTransition('acceptRequest', { isOwner: true, isRequester: false }, undefined)).toBe(false);
	});

	it('allows the requester (not the owner) to request a return of an active loan', () => {
		expect(canTransition('requestReturn', { isOwner: false, isRequester: true }, 'active')).toBe(true);
		expect(canTransition('requestReturn', { isOwner: true, isRequester: false }, 'active')).toBe(false);
	});

	it("allows EITHER participant to abort — role: 'participant' matches owner or requester", () => {
		expect(canTransition('abortRequest', { isOwner: true, isRequester: false }, 'pending')).toBe(true);
		expect(canTransition('abortRequest', { isOwner: false, isRequester: true }, 'accepted')).toBe(true);
		expect(canTransition('abortRequest', { isOwner: false, isRequester: false }, 'pending')).toBe(false);
	});

	it('allows the owner to confirm a return from either active or return_requested', () => {
		expect(canTransition('confirmReturn', { isOwner: true, isRequester: false }, 'active')).toBe(true);
		expect(canTransition('confirmReturn', { isOwner: true, isRequester: false }, 'return_requested')).toBe(true);
		expect(canTransition('confirmReturn', { isOwner: true, isRequester: false }, 'pending')).toBe(false);
	});
});

describe('canAbortUi (#373 — intentionally divergent from the server-side abort rule)', () => {
	it('shows abort to the requester (not the owner) while pending', () => {
		expect(canAbortUi('pending', false)).toBe(true);
		expect(canAbortUi('pending', true)).toBe(false);
	});

	it('shows abort to either party once accepted', () => {
		expect(canAbortUi('accepted', false)).toBe(true);
		expect(canAbortUi('accepted', true)).toBe(true);
	});

	it('hides abort for every other status', () => {
		for (const status of ['active', 'return_requested', 'completed', 'rejected', 'aborted'] as const) {
			expect(canAbortUi(status, false)).toBe(false);
			expect(canAbortUi(status, true)).toBe(false);
		}
	});

	it('hides abort when status is undefined', () => {
		expect(canAbortUi(undefined, false)).toBe(false);
	});
});

// Compile-time guard: LendingStatus is the union of the status literals.
const _typeCheck: LendingStatus = 'completed';
void _typeCheck;
