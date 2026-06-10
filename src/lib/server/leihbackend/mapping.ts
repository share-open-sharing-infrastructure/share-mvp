import { type ItemCategory } from '$lib/texts';

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

/** Subset of `items` fields written by the leihbackend sync. */
export interface MappedItem {
	name: string;
	description: string;
	status: 'available' | 'unavailable';
	categories: string[];
	externalId: string;
	externalUrl: string;
	externalImgUrl: string;
	place: string;
	owner: string;
	trusteesOnly: boolean;
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
 * output is rendered as plain text) — see spec WP1.
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
 * Ordered keyword → category lookup table for `mapCategory()`. Order matters:
 * more specific keywords (e.g. "spielzeug") must precede broader ones (e.g. "spiel")
 * that would otherwise match first. Exported so per-instance overrides can extend it later.
 */
export const CATEGORY_KEYWORDS: Array<[string, ItemCategory]> = [
	['werkzeug', 'Werkzeug und Garten'],
	['garten', 'Werkzeug und Garten'],
	['bohr', 'Werkzeug und Garten'],
	['küche', 'Küche'],
	['koch', 'Küche'],
	['spielzeug', 'Für Kinder'],
	['kind', 'Für Kinder'],
	['baby', 'Für Kinder'],
	['spiel', 'Spiele'],
	['sport', 'Freizeit und Sport'],
	['freizeit', 'Freizeit und Sport'],
	['fitness', 'Freizeit und Sport'],
	['camping', 'Reisen und Outdoor'],
	['outdoor', 'Reisen und Outdoor'],
	['reise', 'Reisen und Outdoor'],
	['zelt', 'Reisen und Outdoor'],
	['elektro', 'Elektronik'],
	['computer', 'Elektronik'],
	['musik', 'Ton und Licht'],
	['licht', 'Ton und Licht'],
	['ton', 'Ton und Licht'],
	['audio', 'Ton und Licht'],
	['beamer', 'Ton und Licht'],
	['buch', 'Bücher'],
	['büch', 'Bücher'],
];

/** Maximum number of categories an AllerLeih item can have, per spec. */
const MAX_CATEGORIES = 3;

/** Maps leihbackend `category` tags to AllerLeih's fixed category list, falling back to 'Sonstiges'. */
export function mapCategory(categories: string[] | undefined | null): string[] {
	const mapped = new Set<string>();

	for (const category of categories ?? []) {
		const normalized = category?.toLowerCase().trim();
		if (!normalized) continue;

		for (const [keyword, target] of CATEGORY_KEYWORDS) {
			if (normalized.includes(keyword)) {
				mapped.add(target);
				break;
			}
		}
	}

	if (mapped.size === 0) return ['Sonstiges'];
	return [...mapped].slice(0, MAX_CATEGORIES);
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

/** Maps a single `item_public` record to AllerLeih `items` fields, per spec §3.1. */
export function mapItem(src: LeihbackendItem, ctx: MapItemContext): MappedItem {
	return {
		externalId: src.id,
		name: src.name.trim().slice(0, MAX_NAME_LENGTH),
		description: buildDescription(src),
		status: src.status === 'instock' ? 'available' : 'unavailable',
		categories: mapCategory(src.category),
		externalImgUrl: src.images?.[0] ? `${ctx.baseUrl}/api/files/item/${src.id}/${src.images[0]}` : '',
		externalUrl: buildExternalUrl(src, ctx.urlTemplate),
		place: ctx.city ?? '',
		owner: ctx.ownerId,
		trusteesOnly: false,
	};
}
