import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	getPosition,
	isPermissionBlocked,
	queryGeoPermission,
	supportsPermissionsQuery,
} from './geolocation';

describe('isPermissionBlocked', () => {
	it('is true only for a hard denial', () => {
		expect(isPermissionBlocked('denied')).toBe(true);
	});

	it('is false for prompt, granted, and unsupported', () => {
		expect(isPermissionBlocked('prompt')).toBe(false);
		expect(isPermissionBlocked('granted')).toBe(false);
		expect(isPermissionBlocked('unsupported')).toBe(false);
	});
});

describe('supportsPermissionsQuery', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is true when navigator.permissions.query is a function', () => {
		vi.stubGlobal('navigator', { permissions: { query: vi.fn() } });
		expect(supportsPermissionsQuery()).toBe(true);
	});

	it('is false when navigator.permissions is absent (iOS Safari)', () => {
		vi.stubGlobal('navigator', {});
		expect(supportsPermissionsQuery()).toBe(false);
	});
});

describe('queryGeoPermission', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves the state reported by the Permissions API', async () => {
		const query = vi.fn().mockResolvedValue({ state: 'granted' });
		vi.stubGlobal('navigator', { permissions: { query } });

		expect(await queryGeoPermission()).toBe('granted');
		expect(query).toHaveBeenCalledWith({ name: 'geolocation' });
	});

	it('resolves prompt and denied states', async () => {
		vi.stubGlobal('navigator', {
			permissions: { query: vi.fn().mockResolvedValue({ state: 'prompt' }) },
		});
		expect(await queryGeoPermission()).toBe('prompt');

		vi.stubGlobal('navigator', {
			permissions: { query: vi.fn().mockResolvedValue({ state: 'denied' }) },
		});
		expect(await queryGeoPermission()).toBe('denied');
	});

	it('resolves unsupported when the query throws (e.g. iOS Safari)', async () => {
		vi.stubGlobal('navigator', {
			permissions: { query: vi.fn().mockRejectedValue(new Error('not supported')) },
		});

		expect(await queryGeoPermission()).toBe('unsupported');
	});

	it('resolves unsupported when navigator.permissions is absent', async () => {
		vi.stubGlobal('navigator', {});

		expect(await queryGeoPermission()).toBe('unsupported');
	});
});

describe('getPosition', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves with lon/lat on success', async () => {
		const getCurrentPosition = vi.fn((success) => {
			success({ coords: { longitude: 7.1, latitude: 50.7 } });
		});
		vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

		await expect(getPosition()).resolves.toEqual({ lon: 7.1, lat: 50.7 });
		expect(getCurrentPosition).toHaveBeenCalledWith(
			expect.any(Function),
			expect.any(Function),
			{ timeout: 15000 }
		);
	});

	it('rejects with the underlying error when the browser denies/fails', async () => {
		const geoError = new Error('User denied geolocation');
		const getCurrentPosition = vi.fn((_success, error) => {
			error(geoError);
		});
		vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

		await expect(getPosition()).rejects.toBe(geoError);
	});

	it('passes through custom PositionOptions', async () => {
		const getCurrentPosition = vi.fn((success) => {
			success({ coords: { longitude: 0, latitude: 0 } });
		});
		vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

		await getPosition({ timeout: 5000, enableHighAccuracy: true });

		expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
			timeout: 5000,
			enableHighAccuracy: true,
		});
	});

	it('rejects immediately when geolocation is unsupported', async () => {
		vi.stubGlobal('navigator', {});

		await expect(getPosition()).rejects.toThrow('Geolocation is not supported');
	});
});
