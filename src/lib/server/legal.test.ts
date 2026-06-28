import { describe, it, expect } from 'vitest';
import { getOutstandingLegalDocs, isLegalLocked, type LegalUser } from './legal';

// The active versions now come from the legal_documents collection (passed in),
// not from a hard-coded constant. Acceptance/decline writes live in the backend
// (allerleih-backend/pb_hooks/legal.pb.js, covered by tests/legal.test.mjs there).
const ACTIVE = { tos: '1.3', privacy: '2.9' };

describe('getOutstandingLegalDocs', () => {
	it('returns nothing for a null user', () => {
		expect(getOutstandingLegalDocs(null, ACTIVE)).toEqual([]);
	});

	it('returns nothing when both current versions are accepted', () => {
		const user: LegalUser = {
			id: 'u1',
			tosAcceptedVersion: '1.3',
			privacyAcceptedVersion: '2.9'
		};
		expect(getOutstandingLegalDocs(user, ACTIVE)).toEqual([]);
	});

	it('flags ToS when its accepted version is stale', () => {
		const user: LegalUser = { id: 'u1', tosAcceptedVersion: '0.1', privacyAcceptedVersion: '2.9' };
		expect(getOutstandingLegalDocs(user, ACTIVE)).toEqual([{ docType: 'tos', version: '1.3' }]);
	});

	it('flags privacy when it has never been accepted', () => {
		const user: LegalUser = { id: 'u1', tosAcceptedVersion: '1.3' };
		expect(getOutstandingLegalDocs(user, ACTIVE)).toEqual([{ docType: 'privacy', version: '2.9' }]);
	});

	it('flags both documents for a user with no acceptances', () => {
		const user: LegalUser = { id: 'u1' };
		expect(getOutstandingLegalDocs(user, ACTIVE).map((d) => d.docType)).toEqual(['tos', 'privacy']);
	});

	it('does not enforce a docType that has no active version configured', () => {
		const user: LegalUser = { id: 'u1' };
		// Only privacy is active → ToS is not flagged even though it was never accepted.
		expect(getOutstandingLegalDocs(user, { privacy: '2.9' })).toEqual([
			{ docType: 'privacy', version: '2.9' }
		]);
	});
});

describe('isLegalLocked', () => {
	it('is true only when legalLocked is truthy', () => {
		expect(isLegalLocked({ legalLocked: true })).toBe(true);
		expect(isLegalLocked({ legalLocked: false })).toBe(false);
		expect(isLegalLocked({})).toBe(false);
		expect(isLegalLocked(null)).toBe(false);
	});
});
