import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { actions, load } from './+page.server';
import { texts } from '$lib/texts';

type ActionEvent = Parameters<typeof actions.confirm>[0];

describe('Reset confirm page', () => {
	let mockLocals: { pb: { collection: ReturnType<typeof vi.fn> } };
	let mockCookies: { set: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = { set: vi.fn() };

		mockLocals = {
			pb: {
				collection: vi.fn(() => ({
					confirmPasswordReset: vi.fn().mockResolvedValue(undefined),
				})),
			},
		};
	});

	function buildRequest(fields: Record<string, string>) {
		const data = new FormData();
		for (const [key, value] of Object.entries(fields)) {
			data.append(key, value);
		}
		return { formData: vi.fn().mockResolvedValue(data) };
	}

	function callConfirm(request: ReturnType<typeof buildRequest>) {
		return actions.confirm({
			locals: mockLocals,
			request,
			cookies: mockCookies,
		} as unknown as ActionEvent);
	}

	describe('load', () => {
		it('returns the token from the URL', async () => {
			const url = new URL('https://allerleih.org/auth/reset/confirm?token=abc123');
			expect(await load({ url } as Parameters<typeof load>[0])).toEqual({ token: 'abc123' });
		});

		it('returns null when no token is present', async () => {
			const url = new URL('https://allerleih.org/auth/reset/confirm');
			expect(await load({ url } as Parameters<typeof load>[0])).toEqual({ token: null });
		});
	});

	describe('actions.confirm', () => {
		it('fails when the token is missing', async () => {
			const request = buildRequest({ password: 'password123', passwordConfirm: 'password123' });

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.invalidOrExpiredResetToken);
		});

		it('fails when the password is too short', async () => {
			const request = buildRequest({
				token: 'tok',
				password: 'short',
				passwordConfirm: 'short',
			});

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.passwordTooShort);
		});

		it('fails when the passwords do not match', async () => {
			const request = buildRequest({
				token: 'tok',
				password: 'password123',
				passwordConfirm: 'password456',
			});

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.passwordsDoNotMatch);
		});

		it('fails with an invalid-token message when PocketBase rejects the token', async () => {
			const confirmPasswordReset = vi.fn().mockRejectedValue(new Error('invalid token'));
			mockLocals.pb.collection = vi.fn(() => ({ confirmPasswordReset }));

			const request = buildRequest({
				token: 'expired-token',
				password: 'password123',
				passwordConfirm: 'password123',
			});

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.invalidOrExpiredResetToken);
		});

		it('confirms the reset, sets a flash cookie and redirects to login', async () => {
			const confirmPasswordReset = vi.fn().mockResolvedValue(undefined);
			mockLocals.pb.collection = vi.fn(() => ({ confirmPasswordReset }));

			const request = buildRequest({
				token: 'valid-token',
				password: 'password123',
				passwordConfirm: 'password123',
			});

			try {
				await callConfirm(request);
				expect.unreachable('expected redirect to be thrown');
			} catch (error) {
				if (!isRedirect(error)) throw error;
				expect(error.status).toBe(303);
				expect(error.location).toBe('/auth/login');
			}

			expect(mockLocals.pb.collection).toHaveBeenCalledWith('users');
			expect(confirmPasswordReset).toHaveBeenCalledWith('valid-token', 'password123', 'password123');
			expect(mockCookies.set).toHaveBeenCalledWith(
				'flash',
				JSON.stringify({ type: 'success', message: texts.success.passwordResetConfirmed }),
				{ path: '/', maxAge: 60 }
			);
		});
	});
});
