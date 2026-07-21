import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { actions } from './+page.server';

type ActionEvent = Parameters<NonNullable<typeof actions.subscribe>>[0];

describe('Newsletter subscribe action', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function buildRequest(fields: Record<string, string>) {
		const data = new FormData();
		for (const [key, value] of Object.entries(fields)) data.append(key, value);
		return { formData: vi.fn().mockResolvedValue(data) };
	}

	function callSubscribe(request: ReturnType<typeof buildRequest>) {
		return actions.subscribe!({ request } as unknown as ActionEvent);
	}

	it('normalizes a mixed-case/whitespace email before sending it to Keila (#557)', async () => {
		const request = buildRequest({
			'contact[email]': '  Julika7@Example.com ',
			'contact[first_name]': 'Julika',
		});

		try {
			await callSubscribe(request);
			expect.unreachable('expected redirect to be thrown');
		} catch (error) {
			if (!isRedirect(error)) throw error;
			expect(error.status).toBe(303);
		}

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
		expect(body.get('contact[email]')).toBe('julika7@example.com');
	});
});
