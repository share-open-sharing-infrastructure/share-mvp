import { texts } from '$lib/texts';

/**
 * The anonymized username a deleted account gets on the backend (`deleted-<15-char id>`).
 * Keep in sync with anonymizeAccount() in allerleih-backend/pb_hooks/services/account.js.
 */
const DELETED_USERNAME_RE = /^deleted-[a-z0-9]{15}$/;

/**
 * Display name for a user, masking deleted/anonymized accounts to "Gelöschtes Konto".
 * Never render `user.username` directly — always pass the user object through this helper.
 *
 * Masks when the `deleted` flag is set, OR when the username matches the backend's
 * placeholder shape. The latter is a safety net for records loaded from a source that
 * doesn't expose `deleted` (e.g. a view that omits the column), so the raw `deleted-<id>`
 * placeholder can never leak to the UI even if the flag is missing.
 */
export function displayName(
	user: { username?: string; deleted?: boolean } | null | undefined
): string {
	if (
		!user ||
		user.deleted ||
		(user.username && DELETED_USERNAME_RE.test(user.username))
	) {
		return texts.account.deletedAccountName;
	}
	return user.username ?? texts.account.deletedAccountName;
}

/**
 * Build the display URL for an item's image, falling back to its external image URL.
 *
 * Item file fields are served via the `items_searchable` view, NOT the record's own
 * `collectionId`. Records read from `items_public` carry that view's id, but its `image`
 * column is a masking expression PocketBase does not serve as a file (→ 404). In
 * `items_searchable`, `image` is a real, trust-filtered file column: it serves public items
 * to everyone and trustees-only items only to authorized viewers. Use this for any item
 * loaded from a public view; base-`items` records (their own `collectionId` already resolves)
 * don't need it.
 */
export function itemImageUrl(
	pbUrl: string,
	item: { id: string; image?: string | null; externalImgUrl?: string | null }
): string | null {
	if (item.image) {
		return `${pbUrl}api/files/items_searchable/${item.id}/${item.image}`;
	}
	return item.externalImgUrl || null;
}

export function formatTimestamp(
	timestamp: string,
	includeYear: boolean = false
): string {
	const d = new Date(timestamp);
	const day = d.getDate();
	const month = d.getMonth() + 1; // months are 0-based
	const year = d.getFullYear();
	const hours = d.getHours();
	const minutes = d.getMinutes();

	// pad single digits (e.g. 3 → 03)
	const pad = (n: number): string => String(n).padStart(2, '0');

	// if today, return only time
	const today = new Date();
	if (d.toDateString() === today.toDateString()) {
		return `${pad(hours)}:${pad(minutes)}`;
	}

	const returnString: string = includeYear
		? `${pad(day)}.${pad(month)}.${pad(year)}`
		: `${pad(day)}.${pad(month)}. ${pad(hours)}:${pad(minutes)}`;

	return returnString;
}

/**
 * Build a `mailto:` href for the email-contact CTA (issue #438). The address is
 * URL-encoded per-part (local @ domain) so a crafted-but-RFC-valid address can't
 * inject extra mailto headers/params into the sender's outgoing mail; subject and
 * body are fully encoded. Returns '' for an empty address (caller hides the link).
 */
export function buildMailtoHref(email: string, subject: string, body: string): string {
	if (!email) return '';
	const at = email.lastIndexOf('@');
	const address =
		at === -1
			? encodeURIComponent(email)
			: `${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}`;
	return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Build the item-detail outbound-link href, routed through `/api/redirect` (which
 * enforces https + records the click). Used for external-item deep links and for an
 * owner's off-platform contact link (issue #438). The destination is URL-encoded so it
 * rides safely as a query param; `/api/redirect` is the authoritative https guard.
 */
export function buildItemRedirectHref(target: string, itemId: string): string {
	return `/api/redirect?to=${encodeURIComponent(target)}&source=item-detail&item=${itemId}`;
}
