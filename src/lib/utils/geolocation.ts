/** Result of feature-detecting the browser's geolocation permission state.
 *  `'unsupported'` covers both the absence of the Permissions API (older iOS Safari)
 *  and any error thrown while querying it — callers must fall back to just calling
 *  `getPosition()` and handling its success/error callbacks in that case. */
export type GeoPermission = 'granted' | 'prompt' | 'denied' | 'unsupported';

/** Feature-detects `navigator.permissions.query` support. iOS Safari never
 *  implements the Permissions API for the `geolocation` descriptor, so callers
 *  use this to decide, synchronously and *before* any `await`, whether it's
 *  safe to check the permission first — see `queryGeoPermission` for why. */
export function supportsPermissionsQuery(): boolean {
	return typeof navigator.permissions?.query === 'function';
}

/** Queries the current geolocation permission state via the Permissions API.
 *  Feature-detects `navigator.permissions.query` and resolves `'unsupported'`
 *  whenever it's missing or throws, rather than rejecting — callers use this to
 *  decide *before* calling `getPosition()`, never as a replacement for it. */
export async function queryGeoPermission(): Promise<GeoPermission> {
	try {
		if (!supportsPermissionsQuery()) return 'unsupported';
		const status = await navigator.permissions.query({ name: 'geolocation' });
		return status.state as GeoPermission;
	} catch {
		return 'unsupported';
	}
}

/** Promise wrapper over `navigator.geolocation.getCurrentPosition`. Defaults to the
 *  15s timeout already used by `StepBrowserLocation.svelte` during onboarding.
 *  Rejects immediately (no native prompt) when geolocation isn't available at all. */
export function getPosition(
	opts: PositionOptions = { timeout: 15000 }
): Promise<{ lon: number; lat: number }> {
	return new Promise((resolve, reject) => {
		if (!('geolocation' in navigator)) {
			reject(new Error('Geolocation is not supported'));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => resolve({ lon: pos.coords.longitude, lat: pos.coords.latitude }),
			(err) => reject(err),
			opts
		);
	});
}

/** Pure predicate: is this permission state a hard denial? When true, calling
 *  `getPosition()` would fire its error callback with no native prompt, so callers
 *  should show the settings-guidance UI instead of a futile request. */
export function isPermissionBlocked(permission: GeoPermission): boolean {
	return permission === 'denied';
}
