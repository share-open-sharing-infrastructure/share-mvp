export type BrowserInfo = { browser: string; version: string };

export type UABrandData = { brands?: { brand: string; version: string }[] };

/**
 * Best-effort browser detection for the feedback form's diagnostic fields.
 * Pure (takes the UA string + optional Client-Hints data) so it is unit-testable
 * outside a component — the caller reads `navigator` and passes both in.
 */
export function detectBrowser(ua: string, uaData?: UABrandData): BrowserInfo {
	let browser = 'unknown';
	let version = 'unknown';

	// 1. Client Hints brands (best signal). Brave/Opera/Vivaldi/Edge return
	// immediately; a chrome/chromium match deliberately does NOT return — a later,
	// more specific brand in the list (or a UA heuristic below) may still override
	// the name while keeping the Chromium version.
	if (uaData?.brands) {
		for (const b of uaData.brands) {
			const brand = b.brand.toLowerCase();
			if (brand.includes('brave')) return { browser: 'brave', version: b.version };
			if (brand.includes('opera')) return { browser: 'opera', version: b.version };
			if (brand.includes('vivaldi')) return { browser: 'vivaldi', version: b.version };
			if (brand.includes('edge')) return { browser: 'edge', version: b.version };
			if (brand.includes('chrome') || brand.includes('chromium')) {
				browser = 'chrome';
				version = b.version;
			}
		}
	}

	// 2. UA heuristics (best-effort, not guaranteed). The Brave/Opera/Vivaldi
	// branches keep whatever version step 1 found — their UA string carries no
	// usable own version marker.
	if (ua.includes('Brave')) {
		browser = 'brave';
	} else if (ua.includes('OPR/') || ua.includes('Opera')) {
		browser = 'opera';
	} else if (ua.includes('Vivaldi')) {
		browser = 'vivaldi';
	} else if (ua.includes('Firefox')) {
		browser = 'firefox';
		version = ua.match(/Firefox\/(\d+)/)?.[1] ?? 'unknown';
	} else if (ua.includes('Safari') && !ua.includes('Chrome')) {
		browser = 'safari';
		version = ua.match(/Version\/(\d+)/)?.[1] ?? 'unknown';
	} else if (ua.includes('Chrome')) {
		browser = 'chrome';
		version = ua.match(/Chrome\/(\d+)/)?.[1] ?? 'unknown';
	}

	return { browser, version };
}
