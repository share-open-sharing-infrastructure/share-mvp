import { describe, it, expect, vi } from 'vitest';

const { TEST_ORIGIN } = vi.hoisted(() => ({ TEST_ORIGIN: 'https://marburg.example.org' }));

vi.mock('$env/dynamic/public', () => ({
	env: { PUBLIC_SITE_ORIGIN: TEST_ORIGIN },
}));

import { GET } from './+server';

describe('GET /robots.txt', () => {
	it('emits the unchanged Disallow rules plus an origin-specific Sitemap line', async () => {
		const response = await GET({} as never);
		const body = await response.text();

		expect(response.headers.get('Content-Type')).toBe('text/plain');
		expect(body).toBe(
			[
				'User-agent: *',
				'Disallow: /conversations/',
				'Disallow: /notifications',
				'Disallow: /social',
				'Disallow: /user/',
				'Disallow: /onboarding',
				'Disallow: /auth/logout',
				'Disallow: /api/',
				'',
				`Sitemap: ${TEST_ORIGIN}/sitemap.xml`,
				'',
			].join('\n')
		);
	});
});
