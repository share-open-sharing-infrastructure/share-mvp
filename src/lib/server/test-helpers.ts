import { vi } from 'vitest';
import type PocketBase from 'pocketbase';

/** Mirror of the real pb.filter(): quotes + escapes strings, substitutes {:param} placeholders. */
export function mockFilter(raw: string, params?: Record<string, unknown>): string {
	if (!params) return raw;
	let result = raw;
	for (const [key, value] of Object.entries(params)) {
		const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : `${value}`;
		result = result.replaceAll(`{:${key}}`, escaped);
	}
	return result;
}

/** Minimal mock pb: collection-name → method-stubs dispatch + the shared filter mock. */
export function makeMockPb(
	impls: Record<string, Record<string, ReturnType<typeof vi.fn>>>
): PocketBase {
	return {
		collection: vi.fn((name: string) => impls[name]),
		filter: vi.fn(mockFilter),
	} as unknown as PocketBase;
}
