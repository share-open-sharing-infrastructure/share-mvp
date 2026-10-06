/**
 * Temporary Deutscher Engagementpreis (DEP) voting banner.
 *
 * REMOVE after 2026-10-29 (the banner expires on its own at DEP_END, no deploy needed to hide
 * it — the code just becomes dead weight). See docs/architecture.md → "DEP voting banner".
 *
 * Pure and framework-free so the visibility rules are unit-testable and shared by the
 * server load (SSR decides whether the banner renders, so there is no flash/layout shift)
 * and the client (builds the dismiss cookie). The caller passes `originHost`; this module
 * deliberately does not import `$lib/instance`.
 */

/** Only this instance shows the banner — one build serves several city instances. */
export const DEP_ORIGIN_HOST = 'allerleih.org';

export const DEP_BANNER_COOKIE = 'dep26-banner';
export const DEP_DISMISSED = 'dismissed';
export const DEP_DISMISSED_FINAL = 'dismissed-final';

/** 2026-10-25T00:00 Berlin time (still CEST; the clocks change at 03:00 that day). */
export const DEP_FINAL_START = new Date('2026-10-24T22:00:00Z');
/** Voting closes 2026-10-29, 17:59 CET. */
export const DEP_END = new Date('2026-10-29T16:59:00Z');

export const DEP_VOTE_URL =
	'https://www.deutscher-engagementpreis.de/publikumspreis/nominierte/6817-matteo-ramin';

export type DepBannerState = 'hidden' | 'normal' | 'final';
export type DepBannerVariant = Exclude<DepBannerState, 'hidden'>;

/** Matched by path segment: `/auth` and `/auth/login` hit, `/authors` does not. */
const EXCLUDED_PATH = /^\/(onboarding|auth|admin)(\/|$)/;

/** Whether the banner never shows on `pathname` (applied via `resolveDepBanner`). */
export function isDepExcludedPath(pathname: string): boolean {
	return EXCLUDED_PATH.test(pathname);
}

/**
 * Instance / time / cookie part of the decision — everything that does not depend on the URL.
 * This is what the root server load calls: reading `event.url.pathname` there would make the
 * load re-run before commit on every navigation. The path and in-session dismissal are applied
 * by `resolveDepBanner` (in DepBanner.svelte, where `page.url.pathname` is available in SSR too).
 */
export function depBannerTimeState(
	now: Date,
	cookie: string | undefined,
	originHost: string
): DepBannerState {
	if (originHost !== DEP_ORIGIN_HOST) return 'hidden';
	if (now >= DEP_END) return 'hidden';

	if (now >= DEP_FINAL_START) {
		// A plain `dismissed` from before the final phase no longer counts: show once more.
		return cookie === DEP_DISMISSED_FINAL ? 'hidden' : 'final';
	}
	return cookie === DEP_DISMISSED || cookie === DEP_DISMISSED_FINAL
		? 'hidden'
		: 'normal';
}

/**
 * Final client-side decision: the server's state (`data.depBanner`), minus the variant already
 * dismissed in this page session (the cookie only takes effect on the next load), minus excluded
 * paths. `null` = render nothing. A later switch to 'final' still shows once after a normal dismiss.
 */
export function resolveDepBanner(
	serverState: DepBannerState,
	dismissed: DepBannerVariant | null,
	pathname: string
): DepBannerVariant | null {
	if (
		serverState === 'hidden' ||
		serverState === dismissed ||
		isDepExcludedPath(pathname)
	) {
		return null;
	}
	return serverState;
}

/**
 * The `document.cookie` string that records a dismissal of `variant`. Lives until the campaign
 * ends. Strictly functional UI preference (no consent needed), hence also no tracking value.
 */
export function depDismissCookie(
	variant: DepBannerVariant,
	now: Date,
	secure: boolean
): string {
	const value = variant === 'final' ? DEP_DISMISSED_FINAL : DEP_DISMISSED;
	const maxAge = Math.max(
		0,
		Math.floor((DEP_END.getTime() - now.getTime()) / 1000)
	);
	return `${DEP_BANNER_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
}
