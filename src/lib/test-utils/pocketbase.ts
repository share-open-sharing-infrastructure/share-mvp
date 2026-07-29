import { vi } from 'vitest';
import type PocketBase from 'pocketbase';

/**
 * Test-only stand-in for PocketBase's `pb.filter(raw, params)` templating: substitutes each
 * `{:key}` placeholder with its (string-quoted) value, mirroring the real SDK closely enough
 * for assertions like `expect(someCollection.getOne).toHaveBeenCalledWith(...)` to see the same
 * filter string production code would build. NOT a full reimplementation (no real escaping
 * guarantees) — good enough because tests never feed it attacker-controlled input.
 *
 * Extracted from the ~15 test files across the repo that hand-rolled an identical copy of this
 * function (see e.g. the pre-refactor `conversation.server.test.ts` / `lending.server.test.ts`).
 */
export function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

/**
 * Builds a minimal mock PocketBase client from per-collection method stubs.
 *
 * `impls` maps a collection name to an object of `vi.fn()` mocks for the methods that
 * collection needs (e.g. `getOne`, `update`, `create`, `getFullList`) — whatever the code
 * under test calls. `pb.filter` is wired to {@link mockFilter}.
 *
 * @example
 * const pb = makeMockPb({
 *   conversations: { getOne: vi.fn().mockResolvedValue(conv), update: vi.fn() },
 *   items: { getOne: vi.fn().mockResolvedValue(item) },
 * });
 */
export function makeMockPb(
	impls: Record<string, Record<string, ReturnType<typeof vi.fn>>>
): PocketBase {
	return {
		collection: vi.fn((name: string) => impls[name]),
		filter: vi.fn(mockFilter),
	} as unknown as PocketBase;
}
