import { describe, it, expect } from 'vitest';
import type { Conversation } from '$lib/types/models';
import { isLending, isConversationActive, matchesRole, matchesActive, emptyReason } from './conversationFilters';

const OWNER = 'userB';
const REQUESTER = 'userA';

function conv(overrides: Partial<Conversation> = {}): Pick<Conversation, 'itemOwner' | 'lendingStatus'> {
	return { itemOwner: OWNER, lendingStatus: undefined, ...overrides };
}

describe('isLending', () => {
	it('is true when the current user is the item owner', () => {
		expect(isLending(conv({ itemOwner: OWNER }), OWNER)).toBe(true);
	});

	it('is false when the current user is the requester', () => {
		expect(isLending(conv({ itemOwner: OWNER }), REQUESTER)).toBe(false);
	});
});

describe('isConversationActive', () => {
	it('is true for a plain chat with no lending status', () => {
		expect(isConversationActive(conv({ lendingStatus: undefined }))).toBe(true);
	});

	it('is true for every OPEN_LENDING_STATES status', () => {
		for (const status of ['pending', 'accepted', 'active', 'return_requested'] as const) {
			expect(isConversationActive(conv({ lendingStatus: status }))).toBe(true);
		}
	});

	it('is false for a terminal status', () => {
		for (const status of ['completed', 'rejected', 'aborted'] as const) {
			expect(isConversationActive(conv({ lendingStatus: status }))).toBe(false);
		}
	});
});

describe('matchesRole', () => {
	const lendingConv = conv({ itemOwner: OWNER });

	it('passes everything when no filter is selected', () => {
		expect(matchesRole(lendingConv, OWNER, null)).toBe(true);
		expect(matchesRole(lendingConv, REQUESTER, null)).toBe(true);
	});

	it("matches the 'lending' filter only for the item owner", () => {
		expect(matchesRole(lendingConv, OWNER, 'lending')).toBe(true);
		expect(matchesRole(lendingConv, REQUESTER, 'lending')).toBe(false);
	});

	it("matches the 'borrowing' filter only for the non-owner", () => {
		expect(matchesRole(lendingConv, OWNER, 'borrowing')).toBe(false);
		expect(matchesRole(lendingConv, REQUESTER, 'borrowing')).toBe(true);
	});
});

describe('matchesActive', () => {
	it('passes everything when showOnlyActive is false', () => {
		expect(matchesActive(conv({ lendingStatus: 'completed' }), false)).toBe(true);
	});

	it('filters out terminal states when showOnlyActive is true', () => {
		expect(matchesActive(conv({ lendingStatus: 'completed' }), true)).toBe(false);
		expect(matchesActive(conv({ lendingStatus: 'pending' }), true)).toBe(true);
		expect(matchesActive(conv({ lendingStatus: undefined }), true)).toBe(true);
	});
});

describe('emptyReason', () => {
	it("returns 'active' whenever the role filter has any match (even if the active-only checkbox hides them all)", () => {
		expect(emptyReason(true, null)).toBe('active');
		expect(emptyReason(true, 'lending')).toBe('active');
	});

	it("returns the selected role filter's name when it has zero matches", () => {
		expect(emptyReason(false, 'lending')).toBe('lending');
		expect(emptyReason(false, 'borrowing')).toBe('borrowing');
	});

	it("returns 'none' when no filter is selected and there are no conversations at all", () => {
		expect(emptyReason(false, null)).toBe('none');
	});
});
