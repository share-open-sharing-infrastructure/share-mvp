import { spawn } from 'node:child_process';

/**
 * Runs once before the whole suite: verify PocketBase is reachable, then seed the
 * deterministic `e2e` scenario (scripts/seed/scenarios/e2e.js). The seed runner tears
 * down previous `@seed.test` data first, so every run starts from a known state.
 */
export default async function globalSetup() {
	const pbUrl = (process.env.PB_URL ?? 'http://127.0.0.1:8091').replace(
		/\/$/,
		''
	);
	const email = process.env.PB_SUPERUSER_EMAIL;
	const password = process.env.PB_SUPERUSER_PASSWORD;

	await assertPocketBaseUp(pbUrl);

	if (!email || !password) {
		throw new Error(
			'e2e seeding needs superuser credentials. Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD ' +
				'(and optionally PB_URL, default http://127.0.0.1:8091) before running the e2e suite.'
		);
	}

	await runSeed({
		PB_URL: pbUrl,
		PB_SUPERUSER_EMAIL: email,
		PB_SUPERUSER_PASSWORD: password,
	});
}

async function assertPocketBaseUp(pbUrl: string) {
	try {
		const res = await fetch(`${pbUrl}/api/health`, {
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) throw new Error(`health check returned ${res.status}`);
	} catch (err) {
		throw new Error(
			`PocketBase is not reachable at ${pbUrl} (${err instanceof Error ? err.message : err}). ` +
				'Start the backend before running the e2e suite. See e2e/README.md.'
		);
	}
}

function runSeed(env: Record<string, string>) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn('node', ['scripts/seed.js', 'e2e'], {
			stdio: 'inherit',
			env: { ...process.env, ...env },
		});
		child.on('error', reject);
		child.on('exit', (code) =>
			code === 0
				? resolve()
				: reject(new Error(`Seeding "e2e" failed with exit code ${code}.`))
		);
	});
}
