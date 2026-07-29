import { texts } from '$lib/texts';

export type ItemStatus = 'available' | 'unavailable' | 'unknown';

/**
 * Single source for the item-status badge (label + colors), used by the item page,
 * the item image overlay and the conversation header. Previously each rendered its
 * own copy of this mapping and they had drifted (missing `unknown` branch, differing
 * border shades) — a color/label change now lands in one place.
 */

/** German label for an item's availability status ('unknown' covers external items). */
export function itemStatusLabel(status: string | null | undefined): string {
	if (status === 'available') return texts.itemStatus.available;
	if (status === 'unavailable') return texts.itemStatus.unavailable;
	return texts.itemStatus.unknown;
}

const BADGE_COLORS: Record<ItemStatus, { base: string; hover: string }> = {
	available: { base: 'bg-green-100 text-green-800 border-green-300', hover: 'hover:bg-green-200' },
	unavailable: {
		base: 'bg-accent-100 text-accent-800 border-accent-300',
		hover: 'hover:bg-accent-200',
	},
	unknown: { base: 'bg-gray-100 text-gray-600 border-gray-300', hover: 'hover:bg-gray-200' },
};

/**
 * Color classes for a status badge. Pass `interactive: true` for badges that are
 * buttons (adds the hover colors). Layout classes (padding, font, position) stay
 * at the call site — they legitimately differ per context.
 */
export function itemStatusBadgeClasses(
	status: string | null | undefined,
	opts: { interactive?: boolean } = {}
): string {
	const key: ItemStatus =
		status === 'available' || status === 'unavailable' ? status : 'unknown';
	const { base, hover } = BADGE_COLORS[key];
	return opts.interactive ? `${base} ${hover}` : base;
}
