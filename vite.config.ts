import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), mkcert()],
	define: {
		// Workaround for vitejs/vite#22419: Vite 8.0.x leaves these dev-client
		// constants unreplaced when the server restarts (e.g. mkcert), crashing
		// /@vite/client with "__BUNDLED_DEV__ is not defined". Remove once Vite
		// ships a fix and the dependency is bumped past it.
		__BUNDLED_DEV__: 'false',
		__SERVER_FORWARD_CONSOLE__: 'false'
	},
	server: {
		host: true  // oder explizit: host: '0.0.0.0'
	}
});
