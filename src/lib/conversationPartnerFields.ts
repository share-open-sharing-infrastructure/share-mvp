import type { ConversationPartner } from '$lib/types/models';

/**
 * Safe subset of `User` fields to expand for a conversation's `requester`/`itemOwner` —
 * excludes `email` and other PII (see `models.ts`'s `User.email` doc: "should not be visible
 * publicly"). Typed against `ConversationPartner` (rather than a plain `string[]`) so removing
 * or renaming a field on that interface is a compile error here instead of a silent runtime gap.
 * Keep in sync with what `ConversationHeader.svelte` (id, username, deleted, profileImage,
 * verified, created) and `ConversationListItem.svelte` (username, deleted, both via
 * `displayName()`) actually read.
 *
 * Lives outside `$lib/server` (unlike the two server `load()`s that also use this) because
 * `conversationListRealtime.ts` needs it client-side, and SvelteKit forbids importing
 * `$lib/server/*` from client code.
 */
const CONVERSATION_PARTNER_FIELDS: (keyof ConversationPartner)[] = [
	'id',
	'username',
	'deleted',
	'profileImage',
	'verified',
	'created',
];

/**
 * Builds a PocketBase `fields` param that restricts the `requester`/`itemOwner` expands to
 * {@link CONVERSATION_PARTNER_FIELDS} (never the full `User` record, in particular never
 * `email`), while leaving `baseFields` — the conversation's own fields plus any other
 * expand (e.g. `requestedItem`, `messages`) — unrestricted.
 */
export function conversationFieldsWithSafePartners(baseFields: string): string {
	const partnerFields = CONVERSATION_PARTNER_FIELDS.flatMap((field) => [
		`expand.requester.${field}`,
		`expand.itemOwner.${field}`,
	]).join(',');
	return `${baseFields},${partnerFields}`;
}
