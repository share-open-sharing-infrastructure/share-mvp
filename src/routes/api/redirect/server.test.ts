import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './+server';

function makeLocals() {
	const create = vi.fn().mockResolvedValue({});
	const collection = vi.fn(() => ({ create }));
	const pb = { collection };
	return { locals: { pb }, create, collection };
}

function makeUrl(params: Record<string, string | null>): URL {
	const search = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v !== null) search.set(k, v);
	return new URL(`https://allerleih.org/api/redirect?${search.toString()}`);
}

let create: ReturnType<typeof makeLocals>['create'];
let collection: ReturnType<typeof makeLocals>['collection'];
let locals: ReturnType<typeof makeLocals>['locals'];

beforeEach(() => {
	({ create, collection, locals } = makeLocals());
});

function get(params: Record<string, string | null>) {
	return GET({ url: makeUrl(params), locals } as never);
}

describe('GET /api/redirect', () => {
	it('rejects a missing destination with 400 and logs nothing', async () => {
		await expect(get({})).rejects.toMatchObject({ status: 400 });
		expect(create).not.toHaveBeenCalled();
	});

	it('rejects a non-https destination with 400 (open-redirect guard) and logs nothing', async () => {
		await expect(
			get({ to: 'http://evil.example/', source: 'item-detail' })
		).rejects.toMatchObject({
			status: 400,
		});
		expect(create).not.toHaveBeenCalled();
	});

	it('logs a partner link and redirects (302)', async () => {
		await expect(
			get({
				to: 'https://verleih.example/form',
				source: 'item-detail',
				item: 'itm123',
			})
		).rejects.toMatchObject({
			status: 302,
			location: 'https://verleih.example/form',
		});
		expect(collection).toHaveBeenCalledWith('outbound_clicks');
		expect(create).toHaveBeenCalledWith({
			destination: 'https://verleih.example/form',
			source_page: 'item-detail',
			item: 'itm123',
		});
	});

	it('logs a footer/social link with no item as item: undefined and redirects (302)', async () => {
		await expect(
			get({ to: 'https://norden.social/@AllerLeih', source: 'footer' })
		).rejects.toMatchObject({
			status: 302,
		});
		expect(collection).toHaveBeenCalledWith('outbound_clicks');
		expect(create).toHaveBeenCalledWith({
			destination: 'https://norden.social/@AllerLeih',
			source_page: 'footer',
			item: undefined,
		});
	});

	it('does NOT log a messenger click from the conversation source (issue #520)', async () => {
		await expect(
			get({
				to: 'https://signal.me/#eu/abc',
				source: 'conversation',
				item: 'itm1',
			})
		).rejects.toMatchObject({
			status: 302,
			location: 'https://signal.me/#eu/abc',
		});
		expect(create).not.toHaveBeenCalled();
	});

	it('does NOT log a conversation-source click even when the destination is not a messenger host', async () => {
		// Isolates the `source === 'conversation'` branch: verleih.example is NOT a
		// messenger host, so only the source check keeps this out of outbound_clicks.
		await expect(
			get({
				to: 'https://verleih.example/form',
				source: 'conversation',
				item: 'itm9',
			})
		).rejects.toMatchObject({
			status: 302,
		});
		expect(create).not.toHaveBeenCalled();
	});

	it('does NOT log a messenger host even if the source param is spoofed', async () => {
		await expect(
			get({ to: 'https://t.me/someuser', source: 'item-detail' })
		).rejects.toMatchObject({
			status: 302,
		});
		expect(create).not.toHaveBeenCalled();

		await expect(
			get({ to: 'https://www.signal.me/#eu/x', source: 'footer' })
		).rejects.toMatchObject({
			status: 302,
		});
		expect(create).not.toHaveBeenCalled();
	});
});
