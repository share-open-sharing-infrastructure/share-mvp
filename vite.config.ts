import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ mode }) => {
	// Read .env (incl. non-PUBLIC_ vars). .env is gitignored, so the test-host
	// stays out of the repo and this config never has to be hand-edited per env.
	const env = loadEnv(mode, process.cwd(), '');

	// Hosts allowed to reach the dev server (Vite blocks unknown Host headers).
	// Set DEV_ALLOWED_HOST in .env, e.g. `.example.com` (leading dot = + subdomains),
	// comma-separated for several. Needed when reaching the dev server through a
	// reverse proxy / tunnel under a custom domain.
	const allowedHosts = (env.DEV_ALLOWED_HOST ?? '')
		.split(',')
		.map((h) => h.trim())
		.filter(Boolean);

	// mkcert gives local HTTPS in dev. Disable with DEV_DISABLE_MKCERT=true when TLS
	// is terminated upstream (proxy/tunnel) or mkcert can't install its CA (sandboxes
	// without sudo).
	const plugins: PluginOption[] = [tailwindcss(), sveltekit()];
	if (env.DEV_DISABLE_MKCERT !== 'true') plugins.push(mkcert());

	return {
		plugins,
		define: {
			// Workaround for vitejs/vite#22419: Vite 8.0.x leaves these dev-client
			// constants unreplaced when the server restarts (e.g. mkcert), crashing
			// /@vite/client with "__BUNDLED_DEV__ is not defined". Remove once Vite
			// ships a fix and the dependency is bumped past it.
			__BUNDLED_DEV__: 'false',
			__SERVER_FORWARD_CONSOLE__: 'false'
		},
		server: {
			host: true, // oder explizit: host: '0.0.0.0'
			...(allowedHosts.length ? { allowedHosts } : {})
		}
	};
});
