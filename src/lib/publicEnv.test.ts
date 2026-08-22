import { describe, it, expect, vi, afterEach } from 'vitest';

// Hermetic default env: mocked so a local `.env` (which may set real PUBLIC_* vars for dev)
// can never skew what "no env vars set" means here. Same pattern as instance.test.ts.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { pbUrl, vapidPublicKey } from './publicEnv';

describe('publicEnv — unset env', () => {
	it('falls back to an empty string instead of throwing (a throw here would 500 the app)', () => {
		expect(pbUrl()).toBe('');
		expect(vapidPublicKey()).toBe('');
	});
});

describe('publicEnv — env var wiring (integration)', () => {
	afterEach(() => {
		vi.doUnmock('$env/dynamic/public');
		vi.resetModules();
	});

	/**
	 * A fresh copy of the module under `env`. Fresh per call because the module registry caches
	 * the `$env/dynamic/public` mock, not because the getters snapshot anything.
	 */
	async function withPublicEnv(env: Record<string, string | undefined>) {
		vi.resetModules();
		vi.doMock('$env/dynamic/public', () => ({ env }));
		return import('./publicEnv');
	}

	it('wires both PUBLIC_* vars through and adds the missing trailing slash to pbUrl()', async () => {
		const { pbUrl: url, vapidPublicKey: key } = await withPublicEnv({
			PUBLIC_PB_URL: 'https://pb.marburg.example.org',
			PUBLIC_VAPID_PUBLIC_KEY: 'BOFZzlLgQ1kjzoCIyyPuVu',
		});
		// Consumers build file URLs as `${pbUrl()}api/files/…`, so the slash cannot be optional.
		expect(url()).toBe('https://pb.marburg.example.org/');
		expect(key()).toBe('BOFZzlLgQ1kjzoCIyyPuVu');
	});

	it('leaves an already-slashed PUBLIC_PB_URL untouched', async () => {
		const { pbUrl: url } = await withPublicEnv({
			PUBLIC_PB_URL: 'https://pb.marburg.example.org/',
		});
		expect(url()).toBe('https://pb.marburg.example.org/');
	});

	it('keeps an unset PUBLIC_PB_URL empty rather than normalising it to "/"', async () => {
		const { pbUrl: url } = await withPublicEnv({});
		expect(url()).toBe('');
	});

	it('reads at call time, so a later env change is picked up without a re-import', async () => {
		const env: Record<string, string | undefined> = {
			PUBLIC_PB_URL: 'http://first/',
		};
		const { pbUrl: url } = await withPublicEnv(env);
		expect(url()).toBe('http://first/');
		env.PUBLIC_PB_URL = 'http://second';
		expect(url()).toBe('http://second/');
	});
});
