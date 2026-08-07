import { describe, it, expect } from 'vitest';
import { normalizeEmail } from './email';

describe('normalizeEmail', () => {
	it('lowercases a mixed-case address (the #557 root cause)', () => {
		expect(normalizeEmail('Julika7@ich-will-net.de')).toBe('julika7@ich-will-net.de');
	});

	it('trims surrounding whitespace', () => {
		expect(normalizeEmail('  julika7@x.de  ')).toBe('julika7@x.de');
	});

	it('trims and lowercases together', () => {
		expect(normalizeEmail(' Julika7@X.de\n')).toBe('julika7@x.de');
	});

	it('leaves an already-normalized address unchanged', () => {
		expect(normalizeEmail('julika7@x.de')).toBe('julika7@x.de');
	});

	it('handles an empty string', () => {
		expect(normalizeEmail('')).toBe('');
	});
});
