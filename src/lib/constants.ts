/**
 * SvelteKit load dependency key for the unread-notification count.
 *
 * Shared by the root layout load (which calls `depends(NOTIFICATIONS_DEP)`) and
 * every place that wants to force a badge resync via `invalidate(NOTIFICATIONS_DEP)`.
 * Keep it a single constant so the two sides can never drift apart and silently
 * turn the invalidation into a no-op (issue #376).
 */
export const NOTIFICATIONS_DEP = 'app:notifications';
