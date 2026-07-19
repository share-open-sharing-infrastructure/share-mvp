import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { actions } from './+page.server';

type ActionEvent = Parameters<typeof actions.reset>[0];

describe('Password reset page action', () => {
	let requestPasswordReset: ReturnType<typeof vi.fn>;
	let mockLocals: { pb: { collection: ReturnType<typeof vi.fn> } };
	let mockCookies: { set: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();
		requestPasswordReset = vi.fn().mockResolvedValue(undefined);
		mockLocals = {
			pb: { collection: vi.fn(() => ({ requestPasswordReset })) },
		};
		mockCookies = { set: vi.fn() };
	});

	function buildRequest(fields: Record<string, string>) {
		const data = new FormData();
		for (const [key, value] of Object.entries(fields)) data.append(key, value);
		return { formData: vi.fn().mockResolvedValue(data) };
	}

	function callReset(request: ReturnType<typeof buildRequest>) {
		return actions.reset({
			locals: mockLocals,
			request,
			cookies: mockCookies,
		} as unknown as ActionEvent);
	}

	it('normalizes a mixed-case/whitespace email before the reset lookup (#557)', async () => {
		const request = buildRequest({ email: '  Julika7@Example.com ' });

		try {
			await callReset(request);
			expect.unreachable('expected redirect to be thrown');
		} catch (error) {
			if (!isRedirect(error)) throw error;
			expect(error.status).toBe(303);
			expect(error.location).toBe('/auth/login');
		}

		expect(requestPasswordReset).toHaveBeenCalledWith('julika7@example.com');
	});

	it('fails with 400 when email is missing', async () => {
		const result = await callReset(buildRequest({}));
		expect(result?.status).toBe(400);
		expect(requestPasswordReset).not.toHaveBeenCalled();
	});
});
