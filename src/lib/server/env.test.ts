import { describe, it, expect } from 'vitest';
import {
	CONDITIONAL_INSTANCE_ENV,
	ENV_PURPOSE,
	OPTIONAL_PRIVATE_ENV,
	OPTIONAL_PUBLIC_ENV,
	REQUIRED_PRIVATE_ENV,
	REQUIRED_PUBLIC_ENV,
	formatMissingEnvError,
	formatOptionalEnvGaps,
	missingInstanceEnv,
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

	it('never reports MISTRAL_API_KEY — one of the optional vars', () => {
		const values = allPresent();
		delete values.MISTRAL_API_KEY;
		expect(OPTIONAL_PRIVATE_ENV).toContain('MISTRAL_API_KEY');
		const read = readerFor(values);
		expect(missingRequiredEnv(read, read)).toEqual([]);
		expect(ALL_REQUIRED).not.toContain('MISTRAL_API_KEY');
	});
});

function nonFlagshipInstanceEnv(): Record<string, string> {
	return {
		PUBLIC_SITE_ORIGIN: 'https://marburg.example.org',
		...Object.fromEntries(CONDITIONAL_INSTANCE_ENV.map((name) => [name, `value-for-${name}`])),
	};
}

describe('missingInstanceEnv', () => {
	it('reports nothing on the flagship instance (PUBLIC_SITE_ORIGIN unset) — issue #646 finding F1', () => {
		const read = readerFor({});
		expect(missingInstanceEnv(read)).toEqual([]);
	});

	it('reports nothing when PUBLIC_SITE_ORIGIN is explicitly the flagship origin', () => {
		const read = readerFor({ PUBLIC_SITE_ORIGIN: 'https://allerleih.org' });
		expect(missingInstanceEnv(read)).toEqual([]);
	});

	it('reports every Class-A var, in registry order, for a non-flagship instance with nothing else set', () => {
		const read = readerFor({ PUBLIC_SITE_ORIGIN: 'https://marburg.example.org' });
		expect(missingInstanceEnv(read)).toEqual([...CONDITIONAL_INSTANCE_ENV]);
	});

	it('reports nothing for a fully-configured non-flagship instance', () => {
		const read = readerFor(nonFlagshipInstanceEnv());
		expect(missingInstanceEnv(read)).toEqual([]);
	});

	it('additionally reports PUBLIC_SITE_ORIGIN itself when set but invalid — closes the masking hole (an invalid origin would otherwise resolve to the flagship default and skip every other check)', () => {
		const read = readerFor({ PUBLIC_SITE_ORIGIN: 'not-a-url' });
		const missing = missingInstanceEnv(read);
		expect(missing).toContain('PUBLIC_SITE_ORIGIN');
		expect(missing).toEqual(expect.arrayContaining([...CONDITIONAL_INSTANCE_ENV]));
	});

	it('counts an empty string as missing, same as unset (strict, like missingRequiredEnv)', () => {
		const values = { ...nonFlagshipInstanceEnv(), PUBLIC_CONTACT_EMAIL: '' };
		const read = readerFor(values);
		expect(missingInstanceEnv(read)).toEqual(['PUBLIC_CONTACT_EMAIL']);
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

	it('adds the §5 TMG explainer paragraph only when a Class-A instance var is among the missing', () => {
		expect(formatMissingEnvError(['PUBLIC_IMPRINT_OPERATOR'])).toContain('§5 TMG');
		expect(formatMissingEnvError(['PUBLIC_SITE_ORIGIN'])).toContain('§5 TMG');
		expect(formatMissingEnvError(['ORS_API_KEY'])).not.toContain('§5 TMG');
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
	// Two readers now (public + private), one per `$env/dynamic/*` store the split registry draws
	// from — mirrors `missingRequiredEnv`'s split.
	const allSet = () => 'a-value';
	const allUnset = () => undefined;

	it('stays silent when every optional var (both registries) is set', () => {
		expect(formatOptionalEnvGaps(allSet, allSet)).toBe('');
	});

	it('counts a whitespace-only value as unset, same as missingRequiredEnv', () => {
		expect(formatOptionalEnvGaps(() => '   ', allSet)).not.toBe('');
	});

	it('reports only the public gap when just PUBLIC_* vars are unset', () => {
		const line = formatOptionalEnvGaps(allUnset, allSet);
		expect(line).toContain('PUBLIC_ONBOARDING_SURVEY_URL');
		expect(line).toContain('PUBLIC_NEWSLETTER_FORM_URL');
		expect(line).not.toContain('MISTRAL_API_KEY');
	});

	it('reports only the private gap when just MISTRAL_API_KEY is unset', () => {
		const line = formatOptionalEnvGaps(allSet, allUnset);
		expect(line).toContain('MISTRAL_API_KEY');
		expect(line).toContain('/api/analyze-item');
		expect(line).not.toContain('PUBLIC_ONBOARDING_SURVEY_URL');
		expect(line).not.toContain('PUBLIC_NEWSLETTER_FORM_URL');
	});

	it('reports every var, public before private, when both registries are entirely unset', () => {
		const line = formatOptionalEnvGaps(allUnset, allUnset);
		const publicIdx = line.indexOf('PUBLIC_ONBOARDING_SURVEY_URL');
		const privateIdx = line.indexOf('MISTRAL_API_KEY');
		expect(publicIdx).toBeGreaterThan(-1);
		expect(privateIdx).toBeGreaterThan(publicIdx);
	});

	it('has a disable-explanation for every name in both optional registries', () => {
		for (const name of OPTIONAL_PUBLIC_ENV) {
			expect(formatOptionalEnvGaps((n) => (n === name ? undefined : 'set'), allSet)).toContain(
				name
			);
		}
		for (const name of OPTIONAL_PRIVATE_ENV) {
			expect(formatOptionalEnvGaps(allSet, (n) => (n === name ? undefined : 'set'))).toContain(
				name
			);
		}
	});
});
