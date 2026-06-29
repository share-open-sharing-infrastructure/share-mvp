// --- Geo types ---

export type OwnerLocation = { id: string; lon: number; lat: number };

// --- ID aliases (for clarity, still plain strings) ---

export type UserId = string;
export type ItemId = string;
export type MessageId = string;
export type GroupId = string;

// --- Base entity shared by all records ---

export interface PocketBaseEntity {
	/** Primary key (PocketBase id) */
	id: string;

	/** ISO datetime string, e.g. "2025-11-28 18:42:11.123Z" */
	created: string;

	/** ISO datetime string, e.g. "2025-11-28 18:42:11.123Z" */
	updated: string;

	/** Optional expanded relations from PocketBase */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	expand?: Record<string, any>;
}

// --- USER ---

export interface User extends PocketBaseEntity {
	/**
	 * Username
	 */
	username: string;

	/**
	 * Email address, should not be visible publicly
	 */
	email: string;

	/**
	 * City / location of the user
	 */
	city?: string;

	/**
	 * List of trusted user ids (friends, family, ...) to whom the user is willing to lend certain items
	 */
	trusts: UserId[];

	/**
	 * Telegram username (without @ prefix)
	 */
	telegramUsername?: string;

	/**
	 * Whether telegram contact is visible only to trusted users
	 */
	telegramVisibleToTrustedOnly?: boolean;

	/**
	 * Signal shareable link
	 */
	signalLink?: string;

	/**
	 * Whether signal contact is visible only to trusted users
	 */
	signalVisibleToTrustedOnly?: boolean;

	/**
	 * Issue #438: when true, the user's items skip the in-app request flow and
	 * offer a `mailto:` contact instead. The address used is `contactEmail`.
	 */
	contactViaEmail?: boolean;

	/**
	 * Dedicated public contact address for the `mailto:` CTA — kept separate from
	 * the private login `email`, so the login address is never exposed. Readable
	 * by any authenticated viewer (base `users` viewRule) but deliberately absent
	 * from every `*_public` view, so it never leaks to unauthenticated browsing.
	 */
	contactEmail?: string;

	/**
	 * Geographic coordinates. PocketBase GeoPoint: {"lon": 12.34, "lat": 56.78}.
	 * Zero value {"lon":0,"lat":0} means no location set (Null Island).
	 */
	geolocation?: { lon: number; lat: number };

	/**
	 * Preferred transport mode for distance-based search
	 */
	preferredTransportMode?: 'foot' | 'bicycle' | 'car';

	/**
	 * Unique invite code for this user's invite link.
	 * Generated lazily on first profile visit if not set.
	 */
	inviteCode?: string;

	/**
	 * Foreign key: the user who invited this user (set at registration via invite link).
	 */
	invitedBy?: UserId;

	/**
	 * Whether the user has completed the onboarding flow.
	 */
	hasOnboarded?: boolean;

	/**
	 * Whether the user has verified their email address.
	 */
	verified?: boolean;

	/**
	 * Marks the account as institutional. Admin-only toggle.
	 * Unlocks the bulk-upload UI and the externalUrl permission on the user's items.
	 */
	isInstitution?: boolean;

	/**
	 * Optional profile picture (PocketBase file name).
	 * For institutional accounts, doubles as the logo.
	 */
	profileImage?: string;

	/**
	 * Free-form profile text (plain text, newlines preserved).
	 * Institutions: address, opening hours, website, lending modalities.
	 */
	bio?: string;

	/**
	 * Set when the user has deleted their account (phase 1 "deactivate"). The row is
	 * anonymized in place; login is blocked and the UI shows "Gelöschtes Konto".
	 */
	deleted?: boolean;

	/** ISO datetime the account was deleted/anonymized (drives the future purge job). */
	deletedAt?: string;

	/**
	 * Cache of the latest platform ToS version this user has accepted (Issue #399).
	 * Authoritative record lives in `user_legal_acceptances`; this mirror lets the
	 * consent gate decide from the already-loaded auth record without a DB query.
	 */
	tosAcceptedVersion?: string;

	/**
	 * Cache of the latest privacy-statement version this user has accepted.
	 * See `tosAcceptedVersion`.
	 */
	privacyAcceptedVersion?: string;

	/**
	 * True when the user declined the current legal documents. Set only by the
	 * `legal.pb.js` backend hook (superuser) and excluded from the user updateRule,
	 * so it cannot be self-cleared — an admin clears it after the matter is resolved.
	 */
	legalLocked?: boolean;
}

export interface UserPublic extends PocketBaseEntity {
	username: string;
	bio: string;
	verified: boolean;
	isInstitution: boolean;
	profileImage: string | null;
	telegramVisibleToTrustedOnly: boolean;
	signalVisibleToTrustedOnly: boolean;
	/** True if this account has been deleted/anonymized — used to mask the username. */
	deleted?: boolean;
}

// --- ITEM ---

export interface Item extends PocketBaseEntity {
	name: string;

	/**
	 * Image file name or URL.
	 * If you use a PocketBase file field, this will usually be the filename
	 * which you then turn into a URL with pb.getFileUrl(...)
	 */
	image: string | null;

	/** Free-text description (you can enforce length via validation, not TS) */
	description: string;

	/** Where the item is located (e.g. "Berlin", "Living room shelf") */
	place: string;

	/** Foreign key: owner user id */
	owner: UserId;

	/** If true, only users in the owner's trusts list can borrow this item */
	trusteesOnly: boolean;

	/**
	 * Group ids this item is shared with. Independent of `trusteesOnly`: members
	 * of any listed group may see/borrow the item whether or not it is
	 * trustees-only. An item is public only when `trusteesOnly` is false AND this
	 * array is empty. Empty when the item is shared with no group.
	 */
	groups?: GroupId[];

	/** Availability status set by the owner */
	status: 'available' | 'unavailable' | 'unknown';

	/** Up to 3 categories selected from the fixed 9-option list */
	categories?: string[];

	/** PocketBase collection id to which the item belongs */
	/** TODO: I don't know why we save this? This should always be the "items" collection, right? */
	collectionId: string;

	/**
	 * Stable identifier in the partner's source system (e.g. WinBIAP Mediennummer).
	 * Upsert key for re-import. Unique per (owner, externalId).
	 */
	externalId?: string;

	/**
	 * Deep link to the item's detail page in the partner's external system.
	 * When set, the item detail page shows a deep-link CTA instead of the AllerLeih request flow.
	 * Only allowed when owner.isInstitution = true.
	 */
	externalUrl?: string;

	/**
	 * URL of an externally-hosted cover/product image.
	 * Displayed when no PocketBase file is uploaded for this item.
	 */
	externalImgUrl?: string;
}

/**
 * Flat row returned by the `items_public` PocketBase view.
 * Mirrors the view's SELECT exactly — field names here must stay in sync with the SQL.
 */
export interface ItemPublic extends PocketBaseEntity {
	id: string;
	name: string;
	image: string | null;
	externalImgUrl: string | null;
	externalUrl: string | null;
	description: string;
	trusteesOnly: boolean;
	status: 'available' | 'unavailable' | 'unknown';
	collectionId: string;
	categories: string[];
	updated: string;
	/** joined user fields */
    userId: UserId;
	username: string;
	isInstitution: boolean;
	bio: string;
	verified: boolean;
	profileImage: string | null;
	userCreated: string;
	/** 1 if the owner has a non-zero geolocation set, 0 otherwise. Evaluated in the view SQL — never exposes coordinates. */
	ownerHasLocation: 0 | 1;
}

// --- GROUPS ---

/**
 * A named, owner-managed circle. Members may see the owner's items that are
 * shared with this group (independent of the item's trustees setting). Created
 * and managed solely by its owner.
 */
export interface Group extends PocketBaseEntity {
	/** Display name */
	name: string;

	/** Optional free-text description */
	description?: string;

	/** Foreign key: the user who owns and manages the group */
	owner: UserId;

	/**
	 * Public groups can be read (name + description) by anyone and joined without
	 * an invite (self-join). Private (default) groups are invite-only.
	 */
	isPublic?: boolean;
}

/**
 * Join-table row: one membership of a user in a group. The owner is ALSO stored
 * here, as a row with role `admin`; invited / self-joined members have role
 * `member`. Unique per (group, user). (Group.owner stays the source of truth for
 * ownership; this admin row is what the roster, the member count and the items
 * visibility rule match against.)
 */
export interface GroupMember extends PocketBaseEntity {
	/** Foreign key: the group */
	group: GroupId;

	/** Foreign key: the member */
	user: UserId;

	/**
	 * Role in the group. The owner is stored as a member with role `admin`;
	 * invited/self-joined members are `member`. Groundwork for co-admins.
	 */
	role?: 'admin' | 'member';
}

/**
 * A shareable invite link for a group. Resolved/consumed via the backend
 * /api/group-invite/{token} endpoints. Only the group owner can create or revoke.
 */
export interface GroupInvite extends PocketBaseEntity {
	/** Foreign key: the group this invite joins */
	group: GroupId;

	/** Random URL token */
	token: string;

	/** ISO datetime after which the invite is no longer usable. Empty = no expiry. */
	expiresAt?: string;

	/** Max number of joins allowed. 0 / empty = unlimited. */
	maxUses?: number;

	/** Number of joins consumed so far */
	uses?: number;

	/** Foreign key: who created the invite */
	createdBy?: UserId;
}

// --- MESSAGE ---

export interface Message extends PocketBaseEntity {
	/** Content */
	messageContent: string;

	/** Foreign key: sender user id */
	from: UserId;

	/** Foreign key: recipient user id */
	to: UserId;
}

export type CounterfactualAnswer =
	| 'pending'
	| 'would_buy'
	| 'not_important'
	| 'too_expensive'
	| 'borrow_elsewhere'
	| 'unsure'
	| 'skipped';

export interface Conversation extends PocketBaseEntity {
	requester: User;
	itemOwner: User;
	requestedItem: Item;
	messages: Message[];
	readByRequester: boolean;
	readByOwner: boolean;
	lendingStatus?: 'pending' | 'accepted' | 'rejected' | 'active' | 'return_requested' | 'completed';
	counterfactual?: CounterfactualAnswer;
}

// --- NOTIFICATION ---

export type NotificationType =
	| 'new_message'
	| 'new_request'
	| 'trust_added'
	| 'invite_accepted'
	| 'request_accepted'
	| 'request_rejected'
	| 'handover_confirmed'
	| 'return_requested'
	| 'return_confirmed';

export interface Notification extends PocketBaseEntity {
	/** Foreign key: recipient user id */
	recipient: UserId;
	/** Foreign key: sender user id */
	sender?: UserId;
	/** Type of notification */
	type: NotificationType;
	/** Related record id (conversation id or user id) */
	relatedId: string;
	/** Pre-formatted German display text */
	body: string;
	/** Whether the recipient has seen this notification */
	read: boolean;
}

// --- LENDING TERMS ---

/**
 * Versioned terms of use ("Leihbedingungen") published by an institutional owner.
 * Each institution (e.g. Mosaique, Commons Zentrum) maintains one record per version.
 * Exactly one record per owner should have `active = true` at any time.
 *
 * Records are treated as immutable once any acceptance refers to them — to update
 * the text, create a new record with a bumped version and flip `active`.
 */
export interface LendingTerms extends PocketBaseEntity {
	/** Foreign key: institution user that issues these terms (must have isInstitution = true) */
	owner: UserId;

	/** Semantic or date-based version string, e.g. "1.0" or "2026-05" */
	version: string;

	/** Human-readable title shown to users, e.g. "Leihbedingungen Leihregal im mosaique" */
	title: string;

	/** Full text of the terms — rendered as-is to the user. Plain text with paragraphs. */
	body: string;

	/** ISO datetime — earliest point at which these terms apply */
	effectiveFrom: string;

	/** Whether this is the currently active version for this owner. Max one per owner. */
	active: boolean;

	/** Minimum age (in years) required to digitally accept these terms. Default 18. */
	minAge: number;

	/** Optional: name of the legally responsible person/body for display */
	contactPerson?: string;
}

/**
 * Audit-trail record of one user accepting one specific version of LendingTerms.
 *
 * Body of the terms is snapshotted at acceptance time so the acceptance remains
 * legally interpretable even if the source `LendingTerms` record changes.
 */
export interface TermAcceptance extends PocketBaseEntity {
	/** Foreign key: user who accepted */
	user: UserId;

	/** Foreign key: the exact LendingTerms record (and thus version) accepted */
	terms: string;

	/** Server-stamped acceptance timestamp (ISO) */
	acceptedAt: string;

	/** Separate confirmation the user is at least minAge years old */
	confirmedAdult: boolean;

	/** Snapshot of the user's username at acceptance time (username may change later) */
	fullNameSnapshot: string;

	/** Snapshot of the full terms body at acceptance time (robust acceptance copy) */
	termsBody: string;

	/** Snapshot of version string for quick display */
	termsVersion?: string;

	/** Snapshot of terms title for quick display */
	termsTitle?: string;

	/** Client IP at acceptance (best-effort, may be proxy IP) */
	userIp?: string;

	/** User-Agent string at acceptance */
	userAgent?: string;
}

/**
 * Lender-defined borrower requirements (issues #423 / #389). One row per owner;
 * a flexible, extensible framework that gates *who may request* an owner's items
 * (not visibility — that stays with trusteesOnly/groups). Each boolean/number
 * field is one requirement type; new types are added as new fields. Enforced
 * authoritatively by the backend hook on conversation create
 * (allerleih-backend/pb_hooks/lending_requirements.pb.js); the frontend mirrors
 * the checks for UX in $lib/server/lendingRequirements.ts.
 */
export interface LendingRequirements extends PocketBaseEntity {
	/** Foreign key: the lender these requirements belong to */
	owner: UserId;

	/** Require the borrower to have a verified email address (users.verified). */
	requireVerifiedEmail: boolean;

	/** Require the borrower to have an address on file (users.city). Issue #389. */
	requireAddress: boolean;
}

/**
 * A single lending requirement the borrower has not yet met, in a form ready to
 * render (label + hint + action link). Produced by
 * `$lib/server/lendingRequirements` and passed to the item-detail CTA. Lives
 * here (not in the server module) so client components can import the type
 * without pulling in a server-only module.
 */
export interface UnmetRequirement {
	key: string;
	/** Label for the quick-fix button that lets the borrower satisfy it. */
	actionLabel: string;
	/** Internal route the borrower goes to in order to satisfy the requirement. */
	actionHref: string;
}

/**
 * One requirement toggle for the owner's settings UI, derived from the requirement
 * registry (see $lib/server/lendingRequirements). Lives here (not in the server
 * module) so the profile component can import the type without a server-only import.
 */
export interface RequirementSetting {
	/** Registry key, e.g. "verifiedEmail". */
	key: string;
	/** Backing column on `lending_requirements`, e.g. "requireVerifiedEmail" — the form field name. */
	field: string;
	/** Owner-facing toggle label. */
	settingsLabel: string;
	/** Owner-facing help text under the toggle. */
	settingsHelp: string;
	/** Whether this requirement is currently switched on for the owner. */
	enabled: boolean;
}

/**
 * Audit-trail record of one user's consent decision on one version of a platform
 * legal document — the Terms of Service or the privacy statement (Issue #399).
 *
 * Immutable (no update/delete API rule). `accepted` records are written by the
 * SvelteKit app under the user's own auth; `declined` records (which also lock
 * the account) are written by the `legal.pb.js` backend hook. The body shown to
 * the user is snapshotted so the decision stays interpretable across text changes.
 */
export interface UserLegalAcceptance extends PocketBaseEntity {
	/** Foreign key: user who made the decision */
	user: UserId;

	/** Which document this decision concerns */
	docType: 'tos' | 'privacy';

	/** Version string of the document at decision time */
	version: string;

	/** Whether the user accepted or declined */
	decision: 'accepted' | 'declined';

	/** Server-stamped decision timestamp (ISO) */
	acceptedAt?: string;

	/** Snapshot of the rendered document body at decision time */
	bodySnapshot?: string;

	/** Client IP at decision (best-effort, may be proxy IP) */
	userIp?: string;

	/** User-Agent string at decision */
	userAgent?: string;
}
