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
}

// --- USER ---

export interface User extends PocketBaseEntity {
  username: string;
  email: string;
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
  field: UserId;
}

// --- MESSAGE ---

export interface Message extends PocketBaseEntity {
  /** Content */
  messageContent: string;

  /** Foreign key: sender user id */
  fromUserId: UserId;

  /** Foreign key: recipient user id */
  toUserId: UserId;
}