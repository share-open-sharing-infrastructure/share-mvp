import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSuperuserClient } = vi.hoisted(() => ({ getSuperuserClient: vi.fn() }));
const { refreshAllIntegrations } = vi.hoisted(() => ({ refreshAllIntegrations: vi.fn() }));

// Hermetic env: never depend on a local .env (absent in CI) — mock all required vars.
const { TEST_SECRET } = vi.hoisted(() => ({ TEST_SECRET: 'test-sync-secret' }));

vi.mock('$env/static/private', () => ({
	SYNC_SECRET: TEST_SECRET,
	PB_SUPERUSER_EMAIL: 'superuser@test.example',
	PB_SUPERUSER_PASSWORD: 'test-password',
}));
vi.mock('$lib/server/integrations/core/pocketbase', () => ({ getSuperuserClient }));
vi.mock('$lib/server/integrations/registry', () => ({ refreshAllIntegrations }));

import { POST } from './+server';

/** Builds a fake RequestEvent (`{ request, url }`) for the handler. */
function makeEvent(authHeader?: string, institution?: string) {
	const headers = new Headers();
	if (authHeader !== undefined) headers.set('authorization', authHeader);
	const url = new URL('https://allerleih.org/api/refresh');
	if (institution) url.searchParams.set('institution', institution);
	return { request: new Request(url, { method: 'POST', headers }), url } as never;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('POST /api/refresh', () => {
	it('returns 401 when the Authorization header is missing', async () => {
		await expect(POST(makeEvent())).rejects.toMatchObject({ status: 401 });
		expect(refreshAllIntegrations).not.toHaveBeenCalled();
	});

	it('returns 401 when the Authorization header is wrong', async () => {
		await expect(POST(makeEvent('Bearer wrong-secret'))).rejects.toMatchObject({ status: 401 });
		expect(refreshAllIntegrations).not.toHaveBeenCalled();
	});

	it('returns 503 if the superuser client cannot authenticate', async () => {
		getSuperuserClient.mockRejectedValue(new Error('auth failed'));

		await expect(POST(makeEvent(`Bearer ${TEST_SECRET}`))).rejects.toMatchObject({ status: 503 });
	});

	it('runs refreshAllIntegrations for all institutions and returns the summaries', async () => {
		const client = {};
		getSuperuserClient.mockResolvedValue(client);
		refreshAllIntegrations.mockResolvedValue([
			{ institution: 'ratsbuecherei', fetched: 3, created: 0, updated: 1, archived: 1, skipped: 1, errors: [], durationMs: 12 },
		]);

		const response = await POST(makeEvent(`Bearer ${TEST_SECRET}`));
		const body = await response.json();

		// No ?institution → undefined forwarded (refresh all).
		expect(refreshAllIntegrations).toHaveBeenCalledWith(client, undefined);
		expect(body.summaries[0].institution).toBe('ratsbuecherei');
	});

	it('forwards the ?institution=<id> query param to refreshAllIntegrations', async () => {
		const client = {};
		getSuperuserClient.mockResolvedValue(client);
		refreshAllIntegrations.mockResolvedValue([]);

		await POST(makeEvent(`Bearer ${TEST_SECRET}`, 'inst42'));

		expect(refreshAllIntegrations).toHaveBeenCalledWith(client, 'inst42');
	});
});
