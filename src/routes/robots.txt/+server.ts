import type { RequestHandler } from '@sveltejs/kit';
import { instanceUrl } from '$lib/instance';

// Same crawl rules as the former static/robots.txt, verbatim. Only the Sitemap: line is
// dynamic — it needs an absolute, instance-specific URL, which a static file can't provide
// across instances (see docs/architecture.md → "Instance configuration (multi-city)").
const DISALLOW_LINES = [
	'User-agent: *',
	'Disallow: /conversations/',
	'Disallow: /notifications',
	'Disallow: /social',
	'Disallow: /user/',
	'Disallow: /onboarding',
	'Disallow: /auth/logout',
	'Disallow: /api/',
];

export const GET: RequestHandler = async () => {
	const body = `${DISALLOW_LINES.join('\n')}\n\nSitemap: ${instanceUrl('/sitemap.xml')}\n`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain',
		},
	});
};
