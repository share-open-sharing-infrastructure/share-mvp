/**
 * Reactive box for "server-load data + local realtime writes".
 *
 * `value` follows `source()` — it re-syncs whenever the tracked dependencies of
 * `source` change (e.g. after `invalidateAll()` / a `use:enhance` reload refreshes
 * the `load()` data) — and is at the same time directly writable, so a realtime
 * event handler can override it optimistically until the next server refresh.
 *
 * This is the canonical writable-`$derived` pattern (assignable deriveds since
 * Svelte 5.25): a reassignment sticks until a dependency changes, then the
 * expression recomputes = sync-from-load. It replaces the `$state` + sync-`$effect`
 * pattern that previously required per-site `svelte/prefer-writable-derived`
 * suppressions (issue #469).
 *
 * Must be called during component initialisation, like any `$derived`.
 *
 * @param source Reads the current server-load value (kept as a closure so the
 *   dependency stays lazily tracked — do not destructure the `data` prop).
 */
export function realtimeSynced<T>(source: () => T) {
	let value = $derived(source());
	return {
		get value() {
			return value;
		},
		set value(v: T) {
			value = v;
		},
	};
}
