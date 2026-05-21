import { ITEM_CATEGORIES } from '$lib/texts';

const PLACEHOLDERS: Record<(typeof ITEM_CATEGORIES)[number], string> = {
	'Freizeit und Sport': '/category-placeholders/Freizeit-und-Sport.svg',
	'Werkzeug und Garten': '/category-placeholders/Werkzeug-und-Garten.svg',
	'Reisen und Outdoor': '/category-placeholders/Freizeit-und-Sport.svg',
	'Bücher': '/category-placeholders/Buecher.svg',
	'Spiele': '/category-placeholders/Spiele.svg',
	'Küche': '/category-placeholders/Kueche.svg',
	'Ton und Licht': '/category-placeholders/Ton-und-Licht.svg',
	'Elektronik': '/category-placeholders/Elektronik.svg',
	'Für Kinder': '/category-placeholders/Fuer-Kinder.svg',
	'Sonstiges': '/category-placeholders/Sonstiges.svg',
};

export function getCategoryPlaceholder(categories: string[]): string | null {
	if (!categories || categories.length === 0) return null;
	return PLACEHOLDERS[categories[0] as (typeof ITEM_CATEGORIES)[number]] ?? null;
}
