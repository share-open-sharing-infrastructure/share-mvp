import { describe, it, expect, vi } from 'vitest';

// Hermetic default env, same rationale as instance.test.ts: `instance-content.ts` has no
// `$env/dynamic/public` import today, but mocking it anyway pins the "no env-driven content"
// claim below without depending on that staying true only by accident.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { instanceContent } from './instance-content';

describe('instanceContent — defaults (static, not env-driven)', () => {
	it('has a non-empty FAQ founder-bio answer', () => {
		expect(typeof instanceContent.faq.whoWeAre).toBe('string');
		expect(instanceContent.faq.whoWeAre.length).toBeGreaterThan(0);
	});

	it('pins the current default founder-bio content (Lüneburg, deliberately not CITY-interpolated)', () => {
		expect(instanceContent.faq.whoWeAre).toContain('Lüneburg');
	});

	it('does not change based on env vars — this is static content, not a template', async () => {
		vi.resetModules();
		vi.doMock('$env/dynamic/public', () => ({
			env: { PUBLIC_INSTANCE_CITY: 'Marburg', PUBLIC_APP_NAME: 'AndersLeih' },
		}));
		const { instanceContent: overridden } = await import('./instance-content');
		expect(overridden.faq.whoWeAre).toBe(instanceContent.faq.whoWeAre);
		expect(overridden.faq.whoWeAre).toContain('Lüneburg');
		vi.doUnmock('$env/dynamic/public');
	});
});
