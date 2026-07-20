import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { actions } from './+page.server';

type ActionEvent = Parameters<typeof actions.login>[0];

describe('Login page action', () => {
	let authWithPassword: ReturnType<typeof vi.fn>;
	let mockLocals: { pb: { collection: ReturnType<typeof vi.fn> } };

	beforeEach(() => {
		vi.clearAllMocks();
		authWithPassword = vi.fn().mockResolvedValue({});
		mockLocals = {
			pb: { collection: vi.fn(() => ({ authWithPassword })) },
		};
	});

	function buildRequest(fields: Record<string, string>) {
		const data = new FormData();
		for (const [key, value] of Object.entries(fields)) data.append(key, value);
		return { formData: vi.fn().mockResolvedValue(data) };
	}

	function callLogin(request: ReturnType<typeof buildRequest>) {
		return actions.login({ locals: mockLocals, request } as unknown as ActionEvent);
	}

	it('normalizes a mixed-case/whitespace email before authenticating (#557)', async () => {
		const request = buildRequest({ email: '  Julika7@Example.com ', password: 'password123' });

		try {
			await callLogin(request);
			expect.unreachable('expected redirect to be thrown');
		} catch (error) {
			if (!isRedirect(error)) throw error;
			expect(error.status).toBe(303);
		}

		expect(authWithPassword).toHaveBeenCalledWith('julika7@example.com', 'password123');
	});

	it('fails with 400 when email is missing', async () => {
		const result = await callLogin(buildRequest({ password: 'password123' }));
		expect(result?.status).toBe(400);
		expect(authWithPassword).not.toHaveBeenCalled();
	});
});
