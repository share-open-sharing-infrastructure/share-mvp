import { type ItemCategory } from '$lib/texts';
import type { MappedItem } from '../core/types';

/**
 * Record shape returned by `{base}/api/collections/item_public/records`.
 * Field names and meaning are documented in docs/leihbackend-integration-spec.md §2.1.
 */
export interface LeihbackendItem {
	id: string;
	iid: number;
	name: string;
	/** HTML (PocketBase editor field) */
	description: string;
	status:
		| 'instock'
		| 'outofstock'
		| 'onbackorder'
		| 'reserved'
		| 'lost'
		| 'repairing'
		| 'forsale';
	deposit: number;
	images: string[];
	synonyms: string;
	category: string[];
	brand: string;
	model: string;
	packaging: string;
	manual: string;
	parts: number;
	copies: number;
	added_on: string;
	is_protected: boolean;
}

export interface MapItemContext {
	/** Normalized base URL of the leihbackend instance (no trailing slash). */
	baseUrl: string;
	/** PocketBase id of the institutional `users` record that owns the synced items. */
	ownerId: string;
	/** Institution's `users.city`, used as the item's `place`. */
	city?: string;
	/** Human-facing deep-link template (`users.leihbackendItemUrlTemplate`), `{id}`/`{iid}` placeholders. */
	urlTemplate?: string;
}

const BLOCK_TAG_REGEX = /<\/?(p|div|li)>|<br\s*\/?>/gi;
const TAG_REGEX = /<[^>]+>/g;

const HTML_ENTITIES: Record<string, string> = {
	'&amp;': '&',
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&apos;': "'",
	'&#39;': "'",
	'&nbsp;': ' ',
};

/**
 * Strips HTML tags from a leihbackend item description, decoding entities and
 * preserving paragraph breaks. Regex-based on purpose (input is trusted-ish,
 * output is rendered as plain text).
 */
export function stripHtml(html: string): string {
	if (!html) return '';

	let text = html.replace(BLOCK_TAG_REGEX, '\n');
	text = text.replace(TAG_REGEX, '');

	// Decode entities after tag stripping, so encoded "<"/">" in the source text
	// are not mistaken for tags.
	text = text.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
	text = text.replace(/&[a-zA-Z]+;/g, (entity) => HTML_ENTITIES[entity] ?? entity);

	text = text.replace(/[ \t]+/g, ' ');
	text = text
		.split('\n')
		.map((line) => line.trim())
		.join('\n');
	text = text.replace(/\n{3,}/g, '\n\n');

	return text.trim();
}

/**
 * Direct mapping from leihbackend's fixed category enum to AllerLeih's category list.
 * Unmapped values (e.g. from a new leihbackend instance with different categories)
 * fall back to 'Sonstiges'. Exported for future per-instance overrides.
 */
export const CATEGORY_MAP: Record<string, ItemCategory> = {
	freizeit: 'Freizeit und Sport',
	garten: 'Werkzeug und Garten',
	haushalt: 'Sonstiges',
	heimwerken: 'Werkzeug und Garten',
	kinder: 'Für Kinder',
	küche: 'Küche',
	sonstige: 'Sonstiges',
};

/** Maximum number of categories an AllerLeih item can have. */
const MAX_CATEGORIES = 3;

/** Maps leihbackend category tags to AllerLeih's fixed category list, falling back to 'Sonstiges'. */
export function mapCategory(categories: string[] | undefined | null): string[] {
	const mapped = [
		...new Set(
			(categories ?? [])
				.map((c) => CATEGORY_MAP[c.toLowerCase().trim()])
				.filter((c): c is ItemCategory => c !== undefined)
		),
	].slice(0, MAX_CATEGORIES);

	return mapped.length > 0 ? mapped : ['Sonstiges'];
}

const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_NAME_LENGTH = 200;

function buildDescription(src: LeihbackendItem): string {
	const base = stripHtml(src.description ?? '');

	const extraLines: string[] = [];
	if (src.iid !== undefined && src.iid !== null) {
		extraLines.push(`Inventarnummer: ${src.iid}`);
	}
	if (src.brand?.trim()) extraLines.push(`Marke: ${src.brand.trim()}`);
	if (src.model?.trim()) extraLines.push(`Modell: ${src.model.trim()}`);
	if (src.parts > 1) extraLines.push(`Teile: ${src.parts}`);
	if (src.deposit > 0) extraLines.push(`Kaution: ${src.deposit} €`);

	const extra = extraLines.join('\n');
	const full = base ? (extra ? `${base}\n\n${extra}` : base) : extra;

	return full.slice(0, MAX_DESCRIPTION_LENGTH);
}

function buildExternalUrl(src: LeihbackendItem, template?: string): string {
	if (!template) return '';
	return template.replace(/\{id\}/g, src.id).replace(/\{iid\}/g, String(src.iid));
}

/** Builds the item's cover image URL from its first image, or '' if it has none. */
function buildImageUrl(src: LeihbackendItem, baseUrl: string): string {
	const firstImage = src.images?.[0];
	if (!firstImage) return '';
	return `${baseUrl}/api/files/item/${src.id}/${firstImage}`;
}

/** Maps a single `item_public` record to AllerLeih `items` fields, per spec §3.1. */
export function mapItem(leihbackendItem: LeihbackendItem, itemContext: MapItemContext): MappedItem {
	return {
		externalId: leihbackendItem.id,
		name: leihbackendItem.name.trim().slice(0, MAX_NAME_LENGTH),
		description: buildDescription(leihbackendItem),
		status: leihbackendItem.status === 'instock' ? 'available' : 'unavailable',
		categories: mapCategory(leihbackendItem.category),
		externalImgUrl: buildImageUrl(leihbackendItem, itemContext.baseUrl),
		externalUrl: buildExternalUrl(leihbackendItem, itemContext.urlTemplate),
		place: itemContext.city ?? '',
		owner: itemContext.ownerId,
		trusteesOnly: false,
	};
}
