import { describe, it, expect, vi, beforeEach } from 'vitest';

import { actions } from './+page.server';

type DeleteEvent = Parameters<typeof actions.deleteAccount>[0];

function setup(sendImpl: () => Promise<unknown> = () => Promise.resolve({ ok: true })) {
	const send = vi.fn(sendImpl);
	const clear = vi.fn();
	const locals = {
		user: { id: 'u1' },
		pb: { send, authStore: { clear } },
	};
	return { locals, send, clear };
}

function callDelete(locals: unknown, password: string | undefined) {
	const fd = new FormData();
	if (password !== undefined) fd.set('password', password);
	return actions.deleteAccount({
		locals,
		request: { formData: vi.fn().mockResolvedValue(fd) },
	} as unknown as DeleteEvent);
}

describe('account: deleteAccount action', () => {
	beforeEach(() => vi.clearAllMocks());

	it('calls the backend DELETE endpoint, clears the session and redirects to the goodbye page', async () => {
		const { locals, send, clear } = setup();

		// redirect() throws — capture it.
		const result = await callDelete(locals, 'secret').catch((e) => e);

		expect(send).toHaveBeenCalledWith('/api/account', {
			method: 'DELETE',
			body: { password: 'secret' },
		});
		expect(clear).toHaveBeenCalledOnce();
		expect(result).toMatchObject({ status: 303, location: '/auth/account-deleted' });
	});

	it('fails with 400 when no password is supplied (no backend call)', async () => {
		const { locals, send } = setup();

		const result = await callDelete(locals, '');

		expect(send).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 400, data: { error: true } });
	});

	it('maps a 400 from the backend to a wrong-password failure', async () => {
		const { locals, clear } = setup(() =>
			Promise.reject(Object.assign(new Error('bad'), { status: 400, response: { code: 'invalid_password' } }))
		);

		const result = await callDelete(locals, 'wrong');

		expect(clear).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 400, data: { error: true } });
	});

	it('maps a 409 from the backend to an active-loans failure', async () => {
		const { locals, clear } = setup(() =>
			Promise.reject(Object.assign(new Error('blocked'), { status: 409, response: { code: 'active_loans' } }))
		);

		const result = await callDelete(locals, 'secret');

		expect(clear).not.toHaveBeenCalled();
		expect(result).toMatchObject({ status: 409, data: { error: true } });
	});
});
