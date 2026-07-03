import type { RequestHandler } from '@sveltejs/kit';

const ORIGIN = 'https://allerleih.org';

const STATIC_PATHS = [
	'/',
	'/search',
	'/misc/about',
	'/misc/guide',
	'/misc/contact',
	'/misc/imprint',
	'/misc/newsletter',
	'/auth/login',
];

export const GET: RequestHandler = async ({ locals }) => {
	const today = new Date().toISOString().split('T')[0];

	const [items, users] = await Promise.all([
		// Use items_searchable, not base items: for an anonymous crawler its rule
		// yields exactly the public items (base items requires auth -> would be
		// empty), and it carries no conversation clause, so conversation-scoped
		// items never leak into the sitemap.
		locals.pb
			.collection('items_searchable')
			.getFullList({ fields: 'id,updated', filter: 'status = "available"' }),
		locals.pb.collection('users').getFullList({ fields: 'id,updated' }),
	]);

	const urls = [
		...STATIC_PATHS.map((path) => ({ loc: `${ORIGIN}${path}`, lastmod: today })),
		...items.map((item) => ({
			loc: `${ORIGIN}/items/${item.id}`,
			lastmod: (item.updated as string).split(' ')[0],
		})),
		...users.map((user) => ({
			loc: `${ORIGIN}/users/${user.id}`,
			lastmod: (user.updated as string).split(' ')[0],
		})),
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=3600',
		},
	});
};
