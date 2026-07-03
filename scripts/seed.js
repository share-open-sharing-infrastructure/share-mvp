/**
 * Seed runner for local development and PR review.
 *
 * Seed data is organised into named *scenarios* under scripts/seed/scenarios/ — one
 * file per feature/PR — so scenarios never collide and the next PR just adds its own
 * file. Shared connection/teardown/factory helpers live in scripts/seed/lib.js.
 *
 * It is safe to ship: it talks to a running PocketBase as a superuser and only ever
 * touches its own records (users on the `@seed.test` domain and what they own), so it
 * never affects production data. Re-running first tears down the previous seed data.
 *
 * Usage (PocketBase must be running):
 *   PB_SUPERUSER_EMAIL=you@example.com PB_SUPERUSER_PASSWORD=secret npm run seed -- <scenario>
 * Examples:
 *   npm run seed -- account-deletion
 *   npm run seed                       # lists available scenarios
 * Optional env: PB_URL (default http://127.0.0.1:8090)
 */
import { readdir } from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connect, teardown } from './seed/lib.js';

const here = dirname(fileURLToPath(import.meta.url));
const scenariosDir = path.join(here, 'seed', 'scenarios');

async function availableScenarios() {
	const files = await readdir(scenariosDir);
	return files.filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, '')).sort();
}

async function main() {
	const scenarios = await availableScenarios();
	const name = process.argv[2] ?? process.env.SEED_SCENARIO;

	if (!name || !scenarios.includes(name)) {
		console.log(
			`${name ? `Unknown scenario "${name}".\n\n` : ''}Available scenarios:\n` +
				scenarios.map((s) => `  - ${s}`).join('\n') +
				`\n\nRun:  npm run seed -- <scenario>`
		);
		process.exit(name ? 1 : 0);
	}

	const pb = await connect();
	const cleared = await teardown(pb);
	if (cleared) console.log(`Cleared ${cleared} previous seed user(s) and their data.`);

	const scenario = await import(pathToFileURL(path.join(scenariosDir, `${name}.js`)).href);
	console.log(`Seeding scenario "${name}": ${scenario.description ?? ''}\n`);
	const summary = await scenario.run(pb);

	console.log(`✓ Seed complete.\n\n${summary ?? ''}\n`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('Seeding failed:', err?.response ?? err?.message ?? err);
		process.exit(1);
	});
