import { describe, it, expect } from 'vitest';
import { detectBrowser } from './browserInfo';

const CHROME_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';
const SAFARI_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

describe('detectBrowser', () => {
	it('prefers a specific Client-Hints brand (Brave) over the generic Chromium entry', () => {
		const uaData = {
			brands: [
				{ brand: 'Chromium', version: '126' },
				{ brand: 'Brave', version: '1.66' },
			],
		};
		expect(detectBrowser(CHROME_UA, uaData)).toEqual({ browser: 'brave', version: '1.66' });
	});

	it('falls back to chrome when only the Chromium brand matches, taking the UA version', () => {
		const uaData = { brands: [{ brand: 'Chromium', version: '126' }] };
		// The chrome brand match does not return, so the UA heuristic refines the version.
		expect(detectBrowser(CHROME_UA, uaData)).toEqual({ browser: 'chrome', version: '126' });
	});

	it('detects Firefox with its version from the UA alone', () => {
		expect(detectBrowser(FIREFOX_UA)).toEqual({ browser: 'firefox', version: '127' });
	});

	it('detects Safari (not misread as Chrome) with its version', () => {
		expect(detectBrowser(SAFARI_UA)).toEqual({ browser: 'safari', version: '17' });
	});

	it('keeps the Chromium version when the UA reveals a derivative without its own marker', () => {
		const uaData = { brands: [{ brand: 'Chromium', version: '126' }] };
		expect(detectBrowser(CHROME_UA + ' Vivaldi/6.7', uaData)).toEqual({
			browser: 'vivaldi',
			version: '126',
		});
	});

	it('returns unknown/unknown for an unrecognized environment', () => {
		expect(detectBrowser('SomeBot/1.0')).toEqual({ browser: 'unknown', version: 'unknown' });
	});
});
