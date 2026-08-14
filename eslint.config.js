import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Buttons go through the design system, not Flowbite (docs/design-system.md);
			// env is read at runtime, never baked into the build (issue #627).
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: 'flowbite-svelte',
							importNames: ['Button'],
							message:
								'Use $lib/components/ui/Button.svelte instead (see docs/design-system.md).',
						},
						{
							name: '$env/static/public',
							message:
								'Use $lib/publicEnv (or `$env/dynamic/public`) — static env is baked into the build, breaking one-artefact-N-instances (#627).',
						},
						{
							name: '$env/static/private',
							message:
								'Use `$env/dynamic/private` — static env is baked into the build and would ship secrets in the artefact (#627).',
						},
					],
				},
			],
		},
	},
	{
		// A service worker has no page globals, so `$env/dynamic/public` resolves to `undefined`
		// there and the first property read throws (issue #627). That makes every module built on
		// it — $lib/publicEnv, $lib/instance and therefore $lib/texts — unusable in the SW. This
		// turns the documented caveat into a lint error instead of a runtime TypeError.
		files: ['src/service-worker.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '$env/dynamic/public',
							message:
								'A service worker has no request context — `$env/dynamic/public` is undefined there (#627).',
						},
						{
							name: '$lib/publicEnv',
							message:
								'$lib/publicEnv reads `$env/dynamic/public`, which is undefined in a service worker (#627).',
						},
						{
							name: '$lib/instance',
							message:
								'$lib/instance reads `$env/dynamic/public`, which is undefined in a service worker (#473/#627).',
						},
						{
							name: '$lib/texts',
							message:
								'$lib/texts transitively imports $lib/instance → `$env/dynamic/public`, undefined in a service worker (#473/#627).',
						},
					],
				},
			],
		},
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig,
			},
		},
	}
);
