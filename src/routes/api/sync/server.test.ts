import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSuperuserClient } = vi.hoisted(() => ({ getSuperuserClient: vi.fn() }));
const { runAllIntegrations } = vi.hoisted(() => ({ runAllIntegrations: vi.fn() }));
// Hermetic env: never depend on a local .env (absent in CI) — mock all required vars.
const { TEST_SECRET } = vi.hoisted(() => ({ TEST_SECRET: 'test-sync-secret' }));

vi.mock('$env/static/private', () => ({
	SYNC_SECRET: TEST_SECRET,
	PB_SUPERUSER_EMAIL: 'superuser@test.example',
	PB_SUPERUSER_PASSWORD: 'test-password',
}));
vi.mock('$lib/server/integrations/core/pocketbase', () => ({ getSuperuserClient }));
vi.mock('$lib/server/integrations/registry', () => ({ runAllIntegrations }));

import { POST } from './+server';

function makeRequest(authHeader?: string): Request {
	const headers = new Headers();
	if (authHeader !== undefined) headers.set('authorization', authHeader);
	return new Request('https://allerleih.org/api/sync', { method: 'POST', headers });
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('POST /api/sync', () => {
	it('returns 401 when the Authorization header is missing', async () => {
		await expect(POST({ request: makeRequest() } as never)).rejects.toMatchObject({ status: 401 });
		expect(runAllIntegrations).not.toHaveBeenCalled();
	});

	it('returns 401 when the Authorization header is wrong', async () => {
		await expect(POST({ request: makeRequest('Bearer wrong-secret') } as never)).rejects.toMatchObject({
			status: 401,
		});
		expect(runAllIntegrations).not.toHaveBeenCalled();
	});

	it('returns 503 if the superuser client cannot authenticate', async () => {
		getSuperuserClient.mockRejectedValue(new Error('auth failed'));

		await expect(POST({ request: makeRequest(`Bearer ${TEST_SECRET}`) } as never)).rejects.toMatchObject({
			status: 503,
		});
	});

	it('runs runAllIntegrations and returns the summaries on success', async () => {
		getSuperuserClient.mockResolvedValue({});
		runAllIntegrations.mockResolvedValue([
			{
				institution: 'commons-zentrum',
				fetched: 1,
				created: 1,
				updated: 0,
				archived: 0,
				skipped: 0,
				errors: [],
				durationMs: 10,
			},
		]);

		const response = await POST({ request: makeRequest(`Bearer ${TEST_SECRET}`) } as never);
		const body = await response.json();

		expect(runAllIntegrations).toHaveBeenCalledTimes(1);
		expect(body.summaries).toHaveLength(1);
		expect(body.summaries[0].institution).toBe('commons-zentrum');
	});

	it('rejects an overlapping run with 429 and releases the lock afterwards', async () => {
		getSuperuserClient.mockResolvedValue({});
		let finishFirstRun!: (value: unknown[]) => void;
		runAllIntegrations.mockReturnValueOnce(new Promise((resolve) => (finishFirstRun = resolve)));
		runAllIntegrations.mockResolvedValue([]);

		const firstRun = POST({ request: makeRequest(`Bearer ${TEST_SECRET}`) } as never);
		// While the first run is still writing, a second (e.g. the next cron tick) must not start.
		await expect(POST({ request: makeRequest(`Bearer ${TEST_SECRET}`) } as never)).rejects.toMatchObject({
			status: 429,
		});
		expect(runAllIntegrations).toHaveBeenCalledTimes(1);

		finishFirstRun([]);
		await firstRun;

		// Lock released: the next request runs normally.
		await POST({ request: makeRequest(`Bearer ${TEST_SECRET}`) } as never);
		expect(runAllIntegrations).toHaveBeenCalledTimes(2);
	});
});

describe('POST /api/sync - missing configuration', () => {
	it('returns 503 when required env vars are missing', async () => {
		vi.resetModules();
		vi.doMock('$env/static/private', () => ({
			SYNC_SECRET: '',
			PB_SUPERUSER_EMAIL: '',
			PB_SUPERUSER_PASSWORD: '',
		}));
		vi.doMock('$lib/server/integrations/core/pocketbase', () => ({ getSuperuserClient: vi.fn() }));
		vi.doMock('$lib/server/integrations/registry', () => ({ runAllIntegrations: vi.fn() }));

		const { POST: postWithMissingEnv } = await import('./+server');

		await expect(postWithMissingEnv({ request: makeRequest('Bearer anything') } as never)).rejects.toMatchObject({
			status: 503,
		});

		vi.doUnmock('$env/static/private');
		vi.doUnmock('$lib/server/integrations/core/pocketbase');
		vi.doUnmock('$lib/server/integrations/registry');
	});
});
