import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRedirect, isHttpError } from '@sveltejs/kit';

const NEWSLETTER_URL = 'https://app.keila.io/forms/nfrm_b94Bj5RD';

// `instance.newsletterFormUrl` (share-mvp#631) is read from `$env/dynamic/public` at module
// scope, so every test below needs a fresh module instance for its own env — same
// `vi.resetModules()` + `vi.doMock()` shape as `instance.test.ts`'s "env var wiring" block.
describe('Newsletter route (load + subscribe action)', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetModules();
		fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.doUnmock('$env/dynamic/public');
	});

	function buildRequest(fields: Record<string, string>) {
		const data = new FormData();
		for (const [key, value] of Object.entries(fields)) data.append(key, value);
		return { formData: vi.fn().mockResolvedValue(data) };
	}

	async function importConfigured(newsletterFormUrl: string | undefined) {
		vi.doMock('$env/dynamic/public', () => ({
			env: newsletterFormUrl ? { PUBLIC_NEWSLETTER_FORM_URL: newsletterFormUrl } : {},
		}));
		return import('./+page.server');
	}

	describe('configured (PUBLIC_NEWSLETTER_FORM_URL set)', () => {
		it('load does not throw', async () => {
			const { load } = await importConfigured(NEWSLETTER_URL);
			expect(() => load({} as never)).not.toThrow();
		});

		it('subscribe POSTs to the configured URL (not the old literal) and normalizes the email (#557)', async () => {
			const { actions } = await importConfigured(NEWSLETTER_URL);
			const request = buildRequest({
				'contact[email]': '  Julika7@Example.com ',
				'contact[first_name]': 'Julika',
			});

			try {
				await actions.subscribe!({ request } as never);
				expect.unreachable('expected redirect to be thrown');
			} catch (thrown) {
				if (!isRedirect(thrown)) throw thrown;
				expect(thrown.status).toBe(303);
			}

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(fetchMock.mock.calls[0][0]).toBe(NEWSLETTER_URL);
			const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
			expect(body.get('contact[email]')).toBe('julika7@example.com');
		});

		// Orchestrator finding B1: the Keila fetch used to be fire-and-forget (unawaited,
		// `.catch(() => {})`), which was latent while this action was dead code but became a live
		// bug once this action became the real signup path. This proves the fetch is genuinely
		// awaited — the mock resolves late, and by the time `redirect()` throws it must already
		// have resolved.
		it('subscribe awaits the Keila fetch before redirecting', async () => {
			const { actions } = await importConfigured(NEWSLETTER_URL);
			let fetchResolved = false;
			fetchMock.mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(() => {
							fetchResolved = true;
							resolve({ ok: true });
						}, 10)
					)
			);
			const request = buildRequest({
				'contact[email]': 'julika7@example.com',
				'contact[first_name]': 'Julika',
			});

			try {
				await actions.subscribe!({ request } as never);
				expect.unreachable('expected redirect to be thrown');
			} catch (thrown) {
				if (!isRedirect(thrown)) throw thrown;
				expect(thrown.status).toBe(303);
			}

			expect(fetchResolved).toBe(true);
		});

		// A rejecting fetch (Keila down, network error, ...) must not 500 the user — it's caught,
		// logged, and the action still redirects to the thanks page.
		it('subscribe still redirects when the Keila fetch rejects, and logs the error', async () => {
			const { actions } = await importConfigured(NEWSLETTER_URL);
			fetchMock.mockRejectedValue(new Error('network down'));
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			const request = buildRequest({
				'contact[email]': 'julika7@example.com',
				'contact[first_name]': 'Julika',
			});

			try {
				await actions.subscribe!({ request } as never);
				expect.unreachable('expected redirect to be thrown');
			} catch (thrown) {
				if (!isRedirect(thrown)) throw thrown;
				expect(thrown.status).toBe(303);
			}

			expect(consoleErrorSpy).toHaveBeenCalled();
			consoleErrorSpy.mockRestore();
		});
	});

	describe('unconfigured (PUBLIC_NEWSLETTER_FORM_URL unset)', () => {
		it('load throws a 404', async () => {
			const { load } = await importConfigured(undefined);
			try {
				load({} as never);
				expect.unreachable('expected a 404 to be thrown');
			} catch (thrown) {
				if (!isHttpError(thrown)) throw thrown;
				expect(thrown.status).toBe(404);
			}
		});

		// Acceptance criterion: an unconfigured instance must not proxy ANY request to a
		// third-party newsletter provider, even via a handcrafted POST straight to the action.
		it('subscribe throws a 404 and never calls fetch', async () => {
			const { actions } = await importConfigured(undefined);
			const request = buildRequest({
				'contact[email]': 'julika7@example.com',
				'contact[first_name]': 'Julika',
			});

			try {
				await actions.subscribe!({ request } as never);
				expect.unreachable('expected a 404 to be thrown');
			} catch (thrown) {
				if (!isHttpError(thrown)) throw thrown;
				expect(thrown.status).toBe(404);
			}

			expect(fetchMock).not.toHaveBeenCalled();
		});
	});
});
