import { describe, it, expect } from 'vitest';
import {
	depBannerTimeState,
	resolveDepBanner,
	isDepExcludedPath,
	depDismissCookie,
	DEP_BANNER_COOKIE,
	DEP_DISMISSED,
	DEP_DISMISSED_FINAL,
	DEP_END,
	DEP_FINAL_START,
	DEP_VOTE_URL,
} from './depBanner';

const HOST = 'allerleih.org';
const at = (iso: string) => new Date(iso);

const EXCLUDED = [
	'/onboarding',
	'/onboarding/step',
	'/auth',
	'/auth/login',
	'/auth/register',
	'/admin',
	'/admin/metrics',
];
const NOT_EXCLUDED = [
	'/',
	'/search',
	'/items/abc',
	'/user/profile',
	'/authors',
	'/administrator',
	'/onboardings',
];

describe('depBanner constants', () => {
	it('pins the campaign timestamps from the issue', () => {
		expect(DEP_FINAL_START.toISOString()).toBe('2026-10-24T22:00:00.000Z');
		expect(DEP_END.toISOString()).toBe('2026-10-29T16:59:00.000Z');
		expect(DEP_BANNER_COOKIE).toBe('dep26-banner');
		expect(DEP_VOTE_URL).toBe(
			'https://www.deutscher-engagementpreis.de/publikumspreis/nominierte/6817-matteo-ramin'
		);
	});
});

describe('depBannerTimeState', () => {
	describe('time window', () => {
		it('shows the normal variant before the final phase', () => {
			expect(
				depBannerTimeState(at('2026-10-06T12:00:00Z'), undefined, HOST)
			).toBe('normal');
		});

		it('shows the normal variant even long before the campaign (no start gate)', () => {
			expect(
				depBannerTimeState(at('2026-01-01T00:00:00Z'), undefined, HOST)
			).toBe('normal');
		});

		it('shows the final variant during the final phase', () => {
			expect(
				depBannerTimeState(at('2026-10-27T12:00:00Z'), undefined, HOST)
			).toBe('final');
		});

		it('is still visible one second before the end', () => {
			expect(
				depBannerTimeState(at('2026-10-29T16:58:59Z'), undefined, HOST)
			).toBe('final');
		});

		it('is hidden exactly at the end', () => {
			expect(
				depBannerTimeState(at('2026-10-29T16:59:00Z'), undefined, HOST)
			).toBe('hidden');
		});

		it('is hidden after the end', () => {
			expect(
				depBannerTimeState(at('2026-10-29T17:00:00Z'), undefined, HOST)
			).toBe('hidden');
			expect(
				depBannerTimeState(at('2027-01-01T00:00:00Z'), undefined, HOST)
			).toBe('hidden');
		});

		it('is hidden after the end regardless of the cookie', () => {
			expect(
				depBannerTimeState(at('2026-11-01T00:00:00Z'), DEP_DISMISSED, HOST)
			).toBe('hidden');
		});
	});

	describe('final-phase boundary', () => {
		it('is still normal one second before the final phase', () => {
			expect(
				depBannerTimeState(at('2026-10-24T21:59:59Z'), undefined, HOST)
			).toBe('normal');
		});

		it('switches to final exactly at the final-phase start', () => {
			expect(
				depBannerTimeState(at('2026-10-24T22:00:00Z'), undefined, HOST)
			).toBe('final');
		});
	});

	describe('dismiss cookie', () => {
		it('treats an unknown cookie value like no cookie', () => {
			expect(
				depBannerTimeState(at('2026-10-06T12:00:00Z'), 'bogus', HOST)
			).toBe('normal');
			expect(
				depBannerTimeState(at('2026-10-27T12:00:00Z'), 'bogus', HOST)
			).toBe('final');
		});

		it('hides the banner when dismissed before the final phase', () => {
			expect(
				depBannerTimeState(at('2026-10-06T12:00:00Z'), DEP_DISMISSED, HOST)
			).toBe('hidden');
			expect(
				depBannerTimeState(at('2026-10-24T21:59:59Z'), DEP_DISMISSED, HOST)
			).toBe('hidden');
		});

		it('re-shows the final variant once the final phase starts, despite "dismissed"', () => {
			expect(
				depBannerTimeState(at('2026-10-24T22:00:00Z'), DEP_DISMISSED, HOST)
			).toBe('final');
			expect(
				depBannerTimeState(at('2026-10-28T09:00:00Z'), DEP_DISMISSED, HOST)
			).toBe('final');
		});

		it('hides the final variant for good once "dismissed-final" is set', () => {
			expect(
				depBannerTimeState(
					at('2026-10-24T22:00:00Z'),
					DEP_DISMISSED_FINAL,
					HOST
				)
			).toBe('hidden');
			expect(
				depBannerTimeState(
					at('2026-10-29T16:58:59Z'),
					DEP_DISMISSED_FINAL,
					HOST
				)
			).toBe('hidden');
		});

		it('also hides the normal variant for "dismissed-final" (e.g. clock skew)', () => {
			expect(
				depBannerTimeState(
					at('2026-10-06T12:00:00Z'),
					DEP_DISMISSED_FINAL,
					HOST
				)
			).toBe('hidden');
		});
	});

	describe('instance gate', () => {
		it.each([
			'lueneburg.example',
			'localhost',
			'www.allerleih.org',
			'ALLERLEIH.ORG',
			'',
		])('is hidden on origin host %j', (host) => {
			expect(
				depBannerTimeState(at('2026-10-06T12:00:00Z'), undefined, host)
			).toBe('hidden');
			expect(
				depBannerTimeState(at('2026-10-27T12:00:00Z'), undefined, host)
			).toBe('hidden');
		});
	});
});

describe('resolveDepBanner', () => {
	it('passes the server variant through when nothing hides it', () => {
		expect(resolveDepBanner('normal', null, '/')).toBe('normal');
		expect(resolveDepBanner('final', null, '/search')).toBe('final');
	});

	it('renders nothing for a hidden server state', () => {
		expect(resolveDepBanner('hidden', null, '/')).toBeNull();
	});

	it('hides the variant dismissed in this page session', () => {
		expect(resolveDepBanner('normal', 'normal', '/')).toBeNull();
		expect(resolveDepBanner('final', 'final', '/')).toBeNull();
	});

	it('still shows final after a normal dismissal (switch mid-session)', () => {
		expect(resolveDepBanner('final', 'normal', '/')).toBe('final');
	});

	it.each(EXCLUDED)(
		'renders nothing on %s, whatever the server state',
		(path) => {
			expect(resolveDepBanner('normal', null, path)).toBeNull();
			expect(resolveDepBanner('final', null, path)).toBeNull();
		}
	);

	it.each(NOT_EXCLUDED)(
		'does not hide on %s (segment match, not prefix match)',
		(path) => {
			expect(resolveDepBanner('normal', null, path)).toBe('normal');
			expect(resolveDepBanner('final', null, path)).toBe('final');
		}
	);
});

describe('isDepExcludedPath', () => {
	it.each(EXCLUDED)('excludes %s', (path) => {
		expect(isDepExcludedPath(path)).toBe(true);
	});

	it.each(NOT_EXCLUDED)(
		'does not exclude %s (segment match, not prefix match)',
		(path) => {
			expect(isDepExcludedPath(path)).toBe(false);
		}
	);
});

describe('depDismissCookie', () => {
	it('records "dismissed" for the normal variant', () => {
		const cookie = depDismissCookie('normal', at('2026-10-06T12:00:00Z'), true);
		expect(cookie.startsWith('dep26-banner=dismissed;')).toBe(true);
	});

	it('records "dismissed-final" for the final variant', () => {
		const cookie = depDismissCookie('final', at('2026-10-27T12:00:00Z'), true);
		expect(cookie.startsWith('dep26-banner=dismissed-final;')).toBe(true);
	});

	it('expires at the end of the campaign (Max-Age floored to whole seconds)', () => {
		// 1 day + 0.5 s before the end -> 86400 s
		const now = new Date(DEP_END.getTime() - 86_400_500);
		expect(depDismissCookie('normal', now, false)).toContain('Max-Age=86400;');
	});

	it('clamps Max-Age to 0 at and after the end', () => {
		expect(depDismissCookie('final', DEP_END, false)).toContain('Max-Age=0;');
		expect(
			depDismissCookie('final', new Date(DEP_END.getTime() + 5000), false)
		).toContain('Max-Age=0;');
	});

	it('is site-wide and SameSite=Lax', () => {
		const cookie = depDismissCookie(
			'normal',
			at('2026-10-06T12:00:00Z'),
			false
		);
		expect(cookie).toContain('Path=/');
		expect(cookie).toContain('SameSite=Lax');
	});

	it('adds Secure only on https', () => {
		const now = at('2026-10-06T12:00:00Z');
		expect(depDismissCookie('normal', now, true).endsWith('; Secure')).toBe(
			true
		);
		expect(depDismissCookie('normal', now, false)).not.toContain('Secure');
	});
});
