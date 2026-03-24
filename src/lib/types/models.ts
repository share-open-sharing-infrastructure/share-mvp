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

	/** PocketBase collection id to which the item belongs */
	/** TODO: I don't know why we save this? This should always be the "items" collection, right? */
	collectionId: string;
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

export interface Conversation extends PocketBaseEntity {
	requester: User;
	itemOwner: User;
	requestedItem: Item;
	messages: Message[];
	readByRequester: boolean;
	readByOwner: boolean;
}
