import { vi } from 'vitest';

export const ME = 'me';
export const params = { id: 'g1' };

// Action results are a union (ActionFailure | …); read fail fields loosely.
export const r = (x: unknown) => x as { status?: number; data?: Record<string, unknown> };

// Build a request whose formData() resolves to the given key/value pairs.
export function req(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.append(k, v);
	return { formData: () => Promise.resolve(fd) };
}

// locals with a pb whose collection(name) returns the per-test stub object.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeLocals(collections: Record<string, any>) {
	return {
		user: { id: ME },
		pb: {
			// Identity, but a spy so tests can assert the parameterized filter call.
			filter: vi.fn((raw: string) => raw),
			collection: vi.fn((name: string) => {
				const stub = collections[name] ?? {};
				// Owner-only actions call isGroupOwner -> groups.getOne. Default to ME owning
				// the group so existing action tests pass the guard; a test can override by
				// providing its own groups.getOne (e.g. { owner: 'someone-else' }).
				if (name === 'groups' && !stub.getOne) {
					return { ...stub, getOne: vi.fn().mockResolvedValue({ id: params.id, owner: ME }) };
				}
				return stub;
			}),
		},
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}
