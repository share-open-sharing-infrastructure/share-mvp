import { describe, it, expect, afterEach, vi } from 'vitest';
import { isHttpError } from '@sveltejs/kit';

// Same guard as `../+page.server.ts` (share-mvp#631) — this page must 404 independently, since
// nobody could have reached it via `/subscribe`'s redirect on an unconfigured instance either.
describe('Newsletter thanks page (load)', () => {
	afterEach(() => {
		vi.resetModules();
		vi.doUnmock('$env/dynamic/public');
	});

	it('does not throw when the newsletter form is configured', async () => {
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_NEWSLETTER_FORM_URL: 'https://app.keila.io/forms/nfrm_b94Bj5RD' },
		}));
		const { load } = await import('./+page.server');
		expect(() => load({} as never)).not.toThrow();
	});

	it('throws a 404 when the newsletter form is unconfigured', async () => {
		vi.doMock('$env/dynamic/public', () => ({ env: {} }));
		const { load } = await import('./+page.server');
		try {
			load({} as never);
			expect.unreachable('expected a 404 to be thrown');
		} catch (thrown) {
			if (!isHttpError(thrown)) throw thrown;
			expect(thrown.status).toBe(404);
		}
	});
});
