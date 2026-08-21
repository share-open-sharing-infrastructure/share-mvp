import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * The runtime environment contract (issue #627). Nothing is verified at `vite build` time
 * any more — one artefact serves any instance — so this list is the only thing that still
 * guarantees a booting server is completely configured.
 *
 * Keep in sync with `.env.example`, README's env table, `docs/architecture.md`
 * ("Current Deployment Pipeline") and the `.env` block in
 * `.github/workflows/deploy-to-uberspace.yaml`.
 */
export const REQUIRED_PUBLIC_ENV = [
	'PUBLIC_PB_URL',
	'PUBLIC_VAPID_PUBLIC_KEY',
] as const;

export const REQUIRED_PRIVATE_ENV = [
	'VAPID_PRIVATE_KEY',
	'VAPID_SUBJECT',
	'ORS_API_KEY',
	'PB_SUPERUSER_EMAIL',
	'PB_SUPERUSER_PASSWORD',
] as const;

type PublicEnvName = (typeof REQUIRED_PUBLIC_ENV)[number];
type PrivateEnvName = (typeof REQUIRED_PRIVATE_ENV)[number];

/** Every name the startup validator knows about — the two registries above, nothing else. */
export type RequiredEnvName = PublicEnvName | PrivateEnvName;

/**
 * What breaks without it — printed next to the name in the startup error. Keyed by
 * `RequiredEnvName`, so adding a var to either registry without a purpose line is a compile
 * error, not a startup message with a bare name and no explanation.
 */
export const ENV_PURPOSE: Record<RequiredEnvName, string> = {
	PUBLIC_PB_URL: 'PocketBase base URL every request talks to',
	PUBLIC_VAPID_PUBLIC_KEY:
		'Web-Push VAPID public key (npx web-push generate-vapid-keys)',
	VAPID_PRIVATE_KEY: 'Web-Push VAPID private key',
	VAPID_SUBJECT: 'Web-Push VAPID subject — a mailto: or https: URL',
	ORS_API_KEY: 'OpenRouteService key for address autocomplete (/api/geocode)',
	PB_SUPERUSER_EMAIL:
		'PocketBase superuser — /admin gate, public stats, metrics_daily',
	PB_SUPERUSER_PASSWORD:
		'PocketBase superuser — /admin gate, public stats, metrics_daily',
};

/**
 * Optional: a missing value disables exactly one feature and must not stop the server.
 * `MISTRAL_API_KEY` unset ⇒ `/api/analyze-item` answers 503; nothing else changes.
 *
 * Turning any of the seven required vars into an optional, feature-toggling one (run without
 * push, without the admin dashboard) is a deliberate follow-up, not something to smuggle in here.
 *
 * **Private-only by construction.** `logOptionalEnvGaps()` reads this whole list from
 * `$env/dynamic/private`, which never holds `PUBLIC_*` vars — so an optional `PUBLIC_*` var
 * cannot just be appended here: it would be reported "running without" even when set. Give this
 * list the split-registry, one-reader-per-store shape of `missingRequiredEnv()` first.
 */
export const OPTIONAL_ENV = ['MISTRAL_API_KEY'] as const;

type OptionalEnvName = (typeof OPTIONAL_ENV)[number];

/** What an unset optional var switches off — reported at startup by `logOptionalEnvGaps()`. */
const OPTIONAL_ENV_DISABLES: Record<OptionalEnvName, string> = {
	MISTRAL_API_KEY: 'AI item analysis, /api/analyze-item answers 503',
};

/**
 * Pure — an empty string counts as missing. Unit-tested directly. Each registry is read through
 * its own store: which of the two a var lives in is declared by the tuple it is listed in, never
 * re-derived from its name (a var in the wrong list would be read from the wrong store and
 * reported "missing" although it is set). Returns registry order: public first, then private.
 */
export function missingRequiredEnv(
	readPublic: (name: PublicEnvName) => string | undefined,
	readPrivate: (name: PrivateEnvName) => string | undefined
): RequiredEnvName[] {
	return [
		...REQUIRED_PUBLIC_ENV.filter((name) => !readPublic(name)?.trim()),
		...REQUIRED_PRIVATE_ENV.filter((name) => !readPrivate(name)?.trim()),
	];
}

/**
 * Pure — the operator-facing message. English on purpose: `texts.ts` is scoped to the German
 * UI copy rendered to end users, while this line is read by a self-hoster in a supervisord /
 * Docker log. Matches the existing precedent in `scripts/seed/lib.js` and `e2e/global-setup.ts`.
 */
export function formatMissingEnvError(
	missing: readonly RequiredEnvName[]
): string {
	const width = Math.max(0, ...missing.map((n) => n.length));
	const lines = missing.map((n) =>
		`  ${n.padEnd(width)}  ${ENV_PURPOSE[n]}`.trimEnd()
	);
	return [
		`AllerLeih cannot start: ${missing.length} required environment variable(s) are missing or empty.`,
		'',
		...lines,
		'',
		'These are read at runtime from process.env, not baked into the build. How they get there',
		'depends on the deployment channel: the Uberspace service is started as',
		'`node -r dotenv/config build`, so one KEY=value line per variable in a `.env` next to',
		'`build/` reaches process.env. The Docker image runs plain `node build` and reads the',
		'process environment only — pass `--env-file`/`-e` (or compose `env_file:`); a `.env`',
		'mounted into the container is NOT read.',
		'See .env.example for the full, annotated list.',
	].join('\n');
}

/** Throws with the full list. Called from the `init` server hook in `src/hooks.server.ts`. */
export function assertRequiredEnv(): void {
	const missing = missingRequiredEnv(
		(name) => publicEnv[name],
		(name) => privateEnv[name]
	);
	if (missing.length > 0) throw new Error(formatMissingEnvError(missing));
}

/**
 * Pure — one line naming the optional vars this instance runs without and what that switches off
 * (`''` when everything is set). Values are never printed. The self-hosting audience otherwise
 * has to diff `.env.example` to find out which feature is quietly off.
 */
export function formatOptionalEnvGaps(
	read: (name: OptionalEnvName) => string | undefined
): string {
	const unset = OPTIONAL_ENV.filter((name) => !read(name)?.trim());
	if (unset.length === 0) return '';
	const disabled = unset
		.map((n) => `${n} (${OPTIONAL_ENV_DISABLES[n]})`)
		.join(', ');
	return `AllerLeih: running without ${disabled}.`;
}

/** Logs the above once, at startup. Called from the `init` server hook, after the assertion. */
export function logOptionalEnvGaps(): void {
	const line = formatOptionalEnvGaps((name) => privateEnv[name]);
	if (line) console.info(line);
}
