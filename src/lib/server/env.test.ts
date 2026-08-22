import { describe, it, expect } from 'vitest';
import {
	ENV_PURPOSE,
	OPTIONAL_ENV,
	REQUIRED_PRIVATE_ENV,
	REQUIRED_PUBLIC_ENV,
	formatMissingEnvError,
	formatOptionalEnvGaps,
	missingRequiredEnv,
} from './env';

// No `$env` mocking anywhere in this file on purpose: both functions under test take the
// environment reader as a parameter, so the whole startup contract (issue #627) is verifiable
// without touching the module registry.

const ALL_REQUIRED = [...REQUIRED_PUBLIC_ENV, ...REQUIRED_PRIVATE_ENV] as const;

/**
 * A reader over one plain object. Passed as *both* arguments at the call sites below, i.e. what
 * `process.env` looks like to the validator when both stores are populated from the same `.env`.
 */
function readerFor(values: Record<string, string | undefined>) {
	return (name: string) => values[name];
}

function allPresent(): Record<string, string> {
	return Object.fromEntries(
		ALL_REQUIRED.map((name) => [name, `value-for-${name}`])
	);
}

describe('missingRequiredEnv', () => {
	it('reports nothing when all seven required vars are set', () => {
		const read = readerFor(allPresent());
		expect(missingRequiredEnv(read, read)).toEqual([]);
	});

	it('reports every required var, in registry order, when the env is empty', () => {
		const read = readerFor({});
		expect(missingRequiredEnv(read, read)).toEqual([
			'PUBLIC_PB_URL',
			'PUBLIC_VAPID_PUBLIC_KEY',
			'VAPID_PRIVATE_KEY',
			'VAPID_SUBJECT',
			'ORS_API_KEY',
			'PB_SUPERUSER_EMAIL',
			'PB_SUPERUSER_PASSWORD',
		]);
	});

	it('counts an empty string as missing (strict — a set-but-blank line is a startup failure)', () => {
		const values = { ...allPresent(), ORS_API_KEY: '' };
		const read = readerFor(values);
		expect(missingRequiredEnv(read, read)).toEqual(['ORS_API_KEY']);
	});

	it('counts a whitespace-only value as missing', () => {
		const values = { ...allPresent(), VAPID_SUBJECT: '   \t ' };
		const read = readerFor(values);
		expect(missingRequiredEnv(read, read)).toEqual(['VAPID_SUBJECT']);
	});

	it('never reports MISTRAL_API_KEY — the one optional var', () => {
		const values = allPresent();
		delete values.MISTRAL_API_KEY;
		expect(OPTIONAL_ENV).toContain('MISTRAL_API_KEY');
		const read = readerFor(values);
		expect(missingRequiredEnv(read, read)).toEqual([]);
		expect(ALL_REQUIRED).not.toContain('MISTRAL_API_KEY');
	});
});

describe('formatMissingEnvError', () => {
	it('names every missing var together with its purpose', () => {
		const message = formatMissingEnvError([
			'PUBLIC_PB_URL',
			'PB_SUPERUSER_PASSWORD',
		]);
		expect(message).toContain('PUBLIC_PB_URL');
		expect(message).toContain(ENV_PURPOSE.PUBLIC_PB_URL);
		expect(message).toContain('PB_SUPERUSER_PASSWORD');
		expect(message).toContain(ENV_PURPOSE.PB_SUPERUSER_PASSWORD);
	});

	it('states how many vars are missing and points at .env.example', () => {
		const message = formatMissingEnvError(ALL_REQUIRED);
		expect(message).toContain(
			`${ALL_REQUIRED.length} required environment variable(s)`
		);
		expect(message).toContain('.env.example');
		expect(message).toContain('process.env');
	});

	it('does not name a var that is set', () => {
		const message = formatMissingEnvError(['ORS_API_KEY']);
		expect(message).not.toContain('PUBLIC_PB_URL');
		expect(message).not.toContain('VAPID_SUBJECT');
	});

	// The empty list is unreachable from `assertRequiredEnv` (it only formats when something is
	// missing), but the `Math.max(0, …)` seed is what keeps the column width from being -Infinity.
	it('survives an empty list without an -Infinity column width', () => {
		expect(formatMissingEnvError([])).toContain(
			'0 required environment variable(s)'
		);
	});
});

describe('the registry itself', () => {
	// A purpose line for every required var is a compile-time guarantee: `ENV_PURPOSE` is keyed
	// by `RequiredEnvName`, so a var added to either tuple without one does not type-check.

	it('reads each registry from its own store, never from the name prefix', () => {
		const publicValues = Object.fromEntries(
			REQUIRED_PUBLIC_ENV.map((n) => [n, 'set'])
		);
		const privateValues = Object.fromEntries(
			REQUIRED_PRIVATE_ENV.map((n) => [n, 'set'])
		);
		const read = (values: Record<string, string>) => (name: string) =>
			values[name];

		expect(missingRequiredEnv(read(publicValues), read(privateValues))).toEqual(
			[]
		);
		// Swapping the two stores makes every var look missing — which is exactly the failure
		// mode a var listed in the wrong tuple would produce.
		expect(missingRequiredEnv(read(privateValues), read(publicValues))).toEqual(
			ALL_REQUIRED
		);
	});
});

describe('formatOptionalEnvGaps', () => {
	it('names the unset optional var and what it disables, without printing a value', () => {
		const line = formatOptionalEnvGaps(() => undefined);
		expect(line).toContain('MISTRAL_API_KEY');
		expect(line).toContain('/api/analyze-item');
	});

	it('stays silent when every optional var is set', () => {
		expect(formatOptionalEnvGaps(() => 'a-key')).toBe('');
		expect(formatOptionalEnvGaps(() => '   ')).not.toBe('');
	});
});
