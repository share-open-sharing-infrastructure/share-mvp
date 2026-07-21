import { describe, it, expect } from 'vitest';
import {
	LENDING_LIFECYCLE,
	LENDING_STATUSES,
	ACTIVE_LENDING_STATES,
	OPEN_LENDING_STATES,
	isLendingStatusIn,
	lendingStatusFilter,
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

// Compile-time guard: LendingStatus is the union of the status literals.
const _typeCheck: LendingStatus = 'completed';
void _typeCheck;
