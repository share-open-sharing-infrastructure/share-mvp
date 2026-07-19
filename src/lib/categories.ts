/**
 * Item categories — fixed and shared across all AllerLeih instances (issue #472).
 *
 * The backend `items` collection's `categories` select field (allerleih-backend) must
 * contain exactly these values; `allerleih-backend/tests/categories.test.mjs` enforces
 * the match. Array order here is the UI display order (filter pills, checkboxes).
 * To change the list, follow the checklist in `docs/data-model.md` → "Item categories".
 */
export const ITEM_CATEGORIES = [
	'Freizeit und Sport',
	'Werkzeug und Garten',
	'Reisen und Outdoor',
	'Bücher',
	'Spiele',
	'Küche',
	'Ton und Licht',
	'Elektronik',
	'Für Kinder',
	'Sonstiges',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
