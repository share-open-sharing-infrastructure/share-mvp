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
 *
 * `thumb` requests a downscaled variant (e.g. '0x300') from PocketBase. The size must be
 * whitelisted in the `items.image` field's `thumbs` option (backend migration
 * `1784402877_image_thumbs.js`), otherwise PocketBase silently serves the original. It is
 * never appended to the `externalImgUrl` fallback — external hosts don't understand it.
 */
export function itemImageUrl(
	pbUrl: string,
	item: { id: string; image?: string | string[] | null; externalImgUrl?: string | null },
	thumb?: string
): string | null {
	const first = Array.isArray(item.image) ? item.image[0] : item.image;
	if (first) {
		const url = `${pbUrl}api/files/items_searchable/${item.id}/${first}`;
		return thumb ? `${url}?thumb=${thumb}` : url;
	}
	return item.externalImgUrl || null;
}

/**
 * All display URLs for an item's images (for the detail-page gallery), in order.
 * Falls back to a single-element list with the external image URL when the item
 * has no uploaded PocketBase files. Empty when there is nothing to show.
 * See {@link itemImageUrl} for the file-serving-via-view rationale.
 */
export function itemImageUrls(
	pbUrl: string,
	item: { id: string; image?: string | string[] | null; externalImgUrl?: string | null }
): string[] {
	const files = Array.isArray(item.image) ? item.image : item.image ? [item.image] : [];
	if (files.length > 0) {
		return files.map((f) => `${pbUrl}api/files/items_searchable/${item.id}/${f}`);
	}
	return item.externalImgUrl ? [item.externalImgUrl] : [];
}

/**
 * Display URLs for an item's uploaded image files served from the record's OWN
 * collection (`collectionId`), in order. Use this for base-`items` records the owner
 * reads directly (their item list, the edit modal) — unlike {@link itemImageUrls}, which
 * serves via the `items_searchable` view for records loaded from a public view. Returns
 * only real uploaded files (no external-image fallback); empty when there are none.
 */
export function itemOwnFileUrls(
	pbUrl: string,
	item: { id: string; collectionId: string; image?: string | string[] | null }
): string[] {
	const files = Array.isArray(item.image) ? item.image : item.image ? [item.image] : [];
	return files.map((f) => `${pbUrl}api/files/${item.collectionId}/${item.id}/${f}`);
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
 * Build an outbound-link href routed through `/api/redirect` (which enforces https +
 * records the click, tagged with `source` for analytics). Both `target` and `source` are
 * URL-encoded so neither can inject extra query params into the href; `/api/redirect` is
 * the authoritative https guard. Used directly for links that aren't scoped to an item
 * (footer social/contribute links); {@link buildItemRedirectHref} delegates to this for the
 * item-scoped case so the `/api/redirect?...` format lives in exactly one place.
 */
export function buildRedirectHref(target: string, source: string): string {
	return `/api/redirect?to=${encodeURIComponent(target)}&source=${encodeURIComponent(source)}`;
}

/**
 * Item-scoped variant of {@link buildRedirectHref}: same `/api/redirect` proxy, plus an
 * `item=<itemId>` query param. Used for external-item deep links, an owner's off-platform
 * contact link (issue #438), and the conversation header's messenger buttons.
 */
export function buildItemRedirectHref(target: string, itemId: string, source: string = 'item-detail'): string {
	return `${buildRedirectHref(target, source)}&item=${itemId}`;
}
