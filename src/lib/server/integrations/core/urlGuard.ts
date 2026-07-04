/**
 * SSRF defense-in-depth for institution-configured base URLs (`users.leihbackendUrl`).
 * These URLs are admin-onboarded, but the integrations fetch them server-side with a
 * superuser client, so a mis-set (or maliciously set) URL must not be able to point the
 * server at itself, the PocketBase admin API, or anything else on the internal network.
 *
 * Checks the URL literal only — a public hostname resolving to a private IP (DNS rebinding)
 * is out of scope here; combined with `redirect: 'manual'` on the actual fetches this keeps
 * the cheap, obvious holes closed.
 */

const PRIVATE_IPV4_RANGES = [
	/^0\./, // "this network"
	/^10\./, // RFC1918
	/^127\./, // loopback
	/^169\.254\./, // link-local
	/^172\.(1[6-9]|2\d|3[01])\./, // RFC1918
	/^192\.168\./, // RFC1918
];

function isPrivateHostname(hostname: string): boolean {
	const host = hostname.toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
	if (PRIVATE_IPV4_RANGES.some((range) => range.test(host))) return true;
	// IPv6 literals arrive bracketed from URL.hostname, e.g. "[::1]".
	if (host.startsWith('[')) {
		const v6 = host.slice(1, -1);
		if (v6 === '::1' || v6 === '::') return true;
		if (/^fe[89ab]/.test(v6)) return true; // link-local fe80::/10
		if (/^f[cd]/.test(v6)) return true; // unique-local fc00::/7
		// IPv4-mapped (URL normalizes "::ffff:127.0.0.1" to hex "::ffff:7f00:1") — reject outright.
		if (v6.startsWith('::ffff:') || v6.includes('.')) return true;
	}
	return false;
}

/**
 * Asserts that `url` is a public `https:` URL an integration may fetch server-side.
 * Throws with an ops-facing message otherwise.
 *
 * @param url - The base or request URL to validate.
 * @param options.allowInsecure - Permit `http:` and private/loopback hosts (dev only).
 */
export function assertPublicHttpUrl(url: string, options: { allowInsecure?: boolean } = {}): void {
	if (options.allowInsecure) return;

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error(`Invalid integration base URL: "${url}"`);
	}

	if (parsed.protocol !== 'https:') {
		throw new Error(`Integration base URL must use https: — got "${url}"`);
	}

	if (isPrivateHostname(parsed.hostname)) {
		throw new Error(`Integration base URL must not point at a private/loopback host: "${url}"`);
	}
}
