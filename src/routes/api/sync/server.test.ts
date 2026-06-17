import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSuperuserClient } = vi.hoisted(() => ({ getSuperuserClient: vi.fn() }));
const { syncAll } = vi.hoisted(() => ({ syncAll: vi.fn() }));

vi.mock('$lib/server/integrations/core/pocketbase', () => ({ getSuperuserClient }));
vi.mock('$lib/server/integrations/registry', () => ({ syncAll }));

import { POST } from './+server';
import { SYNC_SECRET } from '$env/static/private';

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
		expect(syncAll).not.toHaveBeenCalled();
	});

	it('returns 401 when the Authorization header is wrong', async () => {
		await expect(POST({ request: makeRequest('Bearer wrong-secret') } as never)).rejects.toMatchObject({
			status: 401,
		});
		expect(syncAll).not.toHaveBeenCalled();
	});

	it('returns 503 if the superuser client cannot authenticate', async () => {
		getSuperuserClient.mockRejectedValue(new Error('auth failed'));

		await expect(POST({ request: makeRequest(`Bearer ${SYNC_SECRET}`) } as never)).rejects.toMatchObject({
			status: 503,
		});
	});

	it('runs syncAll and returns the summaries on success', async () => {
		getSuperuserClient.mockResolvedValue({});
		syncAll.mockResolvedValue([
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

		const response = await POST({ request: makeRequest(`Bearer ${SYNC_SECRET}`) } as never);
		const body = await response.json();

		expect(syncAll).toHaveBeenCalledTimes(1);
		expect(body.summaries).toHaveLength(1);
		expect(body.summaries[0].institution).toBe('commons-zentrum');
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
		vi.doMock('$lib/server/integrations/registry', () => ({ syncAll: vi.fn() }));

		const { POST: postWithMissingEnv } = await import('./+server');

		await expect(postWithMissingEnv({ request: makeRequest('Bearer anything') } as never)).rejects.toMatchObject({
			status: 503,
		});

		vi.doUnmock('$env/static/private');
		vi.doUnmock('$lib/server/integrations/core/pocketbase');
		vi.doUnmock('$lib/server/integrations/registry');
	});
});
