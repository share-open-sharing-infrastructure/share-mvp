import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { actions, load } from './+page.server';
import { texts } from '$lib/texts';

type ActionEvent = Parameters<typeof actions.confirm>[0];

describe('Confirm email change page', () => {
	let mockLocals: { pb: { collection: ReturnType<typeof vi.fn> } };
	let mockCookies: { set: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = { set: vi.fn() };

		mockLocals = {
			pb: {
				collection: vi.fn(() => ({
					confirmEmailChange: vi.fn().mockResolvedValue(undefined),
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
			const url = new URL('https://allerleih.org/auth/confirm-email-change?token=abc123');
			expect(await load({ url } as Parameters<typeof load>[0])).toEqual({ token: 'abc123' });
		});

		it('returns null when no token is present', async () => {
			const url = new URL('https://allerleih.org/auth/confirm-email-change');
			expect(await load({ url } as Parameters<typeof load>[0])).toEqual({ token: null });
		});

		it('still returns the token after a failed-submit round-trip (action target keeps ?token)', async () => {
			// The form posts to `?/confirm&token=…`, so on re-render the URL still carries the token —
			// keeping data.token set means only the form.fail alert shows, not the {:else} no-token one.
			const url = new URL('https://allerleih.org/auth/confirm-email-change?/confirm&token=abc123');
			expect(await load({ url } as Parameters<typeof load>[0])).toEqual({ token: 'abc123' });
		});
	});

	describe('actions.confirm', () => {
		it('fails when the token is missing', async () => {
			const request = buildRequest({ password: 'password123' });

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.invalidOrExpiredEmailChangeToken);
		});

		it('fails when the password is missing', async () => {
			const request = buildRequest({ token: 'tok' });

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.passwordRequired);
		});

		it('fails with an email-change-failed message when PocketBase rejects the request', async () => {
			const confirmEmailChange = vi.fn().mockRejectedValue(new Error('invalid token or password'));
			mockLocals.pb.collection = vi.fn(() => ({ confirmEmailChange }));

			const request = buildRequest({ token: 'expired-token', password: 'password123' });

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.emailChangeFailed);
		});

		it('confirms the email change, sets a flash cookie and redirects to login', async () => {
			const confirmEmailChange = vi.fn().mockResolvedValue(undefined);
			mockLocals.pb.collection = vi.fn(() => ({ confirmEmailChange }));

			const request = buildRequest({ token: 'valid-token', password: 'password123' });

			try {
				await callConfirm(request);
				expect.unreachable('expected redirect to be thrown');
			} catch (error) {
				if (!isRedirect(error)) throw error;
				expect(error.status).toBe(303);
				expect(error.location).toBe('/auth/login');
			}

			expect(mockLocals.pb.collection).toHaveBeenCalledWith('users');
			expect(confirmEmailChange).toHaveBeenCalledWith('valid-token', 'password123');
			expect(mockCookies.set).toHaveBeenCalledWith(
				'flash',
				JSON.stringify({ type: 'success', message: texts.success.emailChanged }),
				{ path: '/', maxAge: 60 }
			);
		});
	});
});
