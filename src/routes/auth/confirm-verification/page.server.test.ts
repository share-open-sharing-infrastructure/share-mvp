import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { actions, load } from './+page.server';
import { texts } from '$lib/texts';

type ActionEvent = Parameters<typeof actions.confirm>[0];

describe('Confirm verification page', () => {
	let mockLocals: { pb: { collection: ReturnType<typeof vi.fn> } };
	let mockCookies: { set: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();

		mockCookies = { set: vi.fn() };

		mockLocals = {
			pb: {
				collection: vi.fn(() => ({
					confirmVerification: vi.fn().mockResolvedValue(undefined),
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
			const url = new URL('https://allerleih.org/auth/confirm-verification?token=abc123');
			expect(await load({ url } as Parameters<typeof load>[0])).toEqual({ token: 'abc123' });
		});

		it('returns null when no token is present', async () => {
			const url = new URL('https://allerleih.org/auth/confirm-verification');
			expect(await load({ url } as Parameters<typeof load>[0])).toEqual({ token: null });
		});

		it('still returns the token after a failed-submit round-trip (action target keeps ?token)', async () => {
			// The form posts to `?/confirm&token=…`, so on re-render the URL still carries the token —
			// keeping data.token set means only the form.fail alert shows, not the {:else} no-token one.
			const url = new URL('https://allerleih.org/auth/confirm-verification?/confirm&token=abc123');
			expect(await load({ url } as Parameters<typeof load>[0])).toEqual({ token: 'abc123' });
		});
	});

	describe('actions.confirm', () => {
		it('fails when the token is missing', async () => {
			const request = buildRequest({});

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.invalidOrExpiredVerificationToken);
		});

		it('fails with an invalid-token message when PocketBase rejects the token', async () => {
			const confirmVerification = vi.fn().mockRejectedValue(new Error('invalid token'));
			mockLocals.pb.collection = vi.fn(() => ({ confirmVerification }));

			const request = buildRequest({ token: 'expired-token' });

			const result = await callConfirm(request);

			expect(result?.status).toBe(400);
			expect(result?.data?.message).toBe(texts.errors.invalidOrExpiredVerificationToken);
		});

		it('confirms the verification, sets a flash cookie and redirects to login', async () => {
			const confirmVerification = vi.fn().mockResolvedValue(undefined);
			mockLocals.pb.collection = vi.fn(() => ({ confirmVerification }));

			const request = buildRequest({ token: 'valid-token' });

			try {
				await callConfirm(request);
				expect.unreachable('expected redirect to be thrown');
			} catch (error) {
				if (!isRedirect(error)) throw error;
				expect(error.status).toBe(303);
				expect(error.location).toBe('/auth/login');
			}

			expect(mockLocals.pb.collection).toHaveBeenCalledWith('users');
			expect(confirmVerification).toHaveBeenCalledWith('valid-token');
			expect(mockCookies.set).toHaveBeenCalledWith(
				'flash',
				JSON.stringify({ type: 'success', message: texts.success.emailVerified }),
				{ path: '/', maxAge: 60 }
			);
		});
	});
});
