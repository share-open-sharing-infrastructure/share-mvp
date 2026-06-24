// --- Geo types ---

export type OwnerLocation = { id: string; lon: number; lat: number };

// --- ID aliases (for clarity, still plain strings) ---

export type UserId = string;
export type ItemId = string;
export type MessageId = string;

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
