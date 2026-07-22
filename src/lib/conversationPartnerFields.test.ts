import { describe, it, expect } from 'vitest';
import { conversationFieldsWithSafePartners } from './conversationPartnerFields';

describe('conversationFieldsWithSafePartners', () => {
	it('appends the safe requester/itemOwner partner fields to the base fields', () => {
		expect(conversationFieldsWithSafePartners('*')).toBe(
			'*,expand.requester.id,expand.itemOwner.id,' +
				'expand.requester.username,expand.itemOwner.username,' +
				'expand.requester.deleted,expand.itemOwner.deleted,' +
				'expand.requester.profileImage,expand.itemOwner.profileImage,' +
				'expand.requester.verified,expand.itemOwner.verified,' +
				'expand.requester.created,expand.itemOwner.created'
		);
	});

	it('never includes email, regardless of the base fields passed in', () => {
		const result = conversationFieldsWithSafePartners('*,expand.requestedItem.*');
		expect(result).not.toMatch(/email/i);
	});
});
