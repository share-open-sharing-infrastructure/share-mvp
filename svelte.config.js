import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			bodySize: 10 * 1024 * 1024, // 10MB for bulk image uploads
		}),
	},
};

export default config;
