import { describe, it, expect, vi, beforeEach } from 'vitest';

// MISTRAL_API_KEY is the one optional var (see $lib/server/env.ts). Unset ⇒ the endpoint must
// answer 503 instead of constructing an unauthenticated Mistral client (issue #627).
vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { complete } = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock('@mistralai/mistralai', () => ({
	Mistral: class {
		chat = { complete };
	},
}));

import { POST } from './+server';

type ThrownError = { status: number; body?: { message: string } };

async function capture(fn: () => unknown): Promise<ThrownError> {
	try {
		await fn();
	} catch (e) {
		return e as ThrownError;
	}
	throw new Error('expected a thrown error, but none was thrown');
}

function makeEvent(userId: string | null) {
	const json = vi
		.fn()
		.mockResolvedValue({ imageBase64: 'x', mimeType: 'image/png' });
	return {
		request: { json },
		locals: { user: userId ? { id: userId } : null },
		json,
	};
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/analyze-item', () => {
	it('answers 503 when MISTRAL_API_KEY is unset', async () => {
		const event = makeEvent('user-503');
		const result = await capture(() => POST(event as never));

		expect(result.status).toBe(503);
		expect(result.body?.message).toContain('not configured');
		expect(complete).not.toHaveBeenCalled();
	});

	it('refuses the feature before reading the request body', async () => {
		const event = makeEvent('user-order');
		await capture(() => POST(event as never));

		expect(event.json).not.toHaveBeenCalled();
	});

	it('still rejects an unauthenticated caller with 401', async () => {
		const event = makeEvent(null);
		const result = await capture(() => POST(event as never));

		expect(result.status).toBe(401);
	});
});
