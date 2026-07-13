import { describe, it, expect } from 'vitest';
import {
	normalizeUsername,
	validateUsername,
	USERNAME_MIN_LENGTH,
	USERNAME_MAX_LENGTH,
} from './username';

describe('normalizeUsername', () => {
	it('trims leading and trailing whitespace', () => {
		expect(normalizeUsername('  alice  ')).toBe('alice');
	});

	it('collapses repeated internal whitespace to a single space', () => {
		expect(normalizeUsername('AStA   Lüneburg')).toBe('AStA Lüneburg');
	});

	it('collapses tabs and newlines as whitespace', () => {
		expect(normalizeUsername('a\t\nb')).toBe('a b');
	});
});

describe('validateUsername', () => {
	it('accepts a simple ascii name', () => {
		expect(validateUsername('testuser')).toBe('ok');
	});

	it('accepts unicode letters', () => {
		expect(validateUsername('MüllerMax')).toBe('ok');
	});

	it('accepts internal spaces (institution names)', () => {
		expect(validateUsername('Ratsbücherei Lüneburg')).toBe('ok');
		expect(validateUsername('janun e.V.')).toBe('ok');
	});

	it('accepts dots, hyphens and underscores', () => {
		expect(validateUsername('a.b-c_d')).toBe('ok');
	});

	it('treats leading/trailing spaces as trimmed, not invalid', () => {
		expect(validateUsername('  alice  ')).toBe('ok');
	});

	it('rejects names shorter than the minimum', () => {
		expect(validateUsername('ab')).toBe('too_short');
	});

	it('accepts a name exactly at the minimum length', () => {
		expect(validateUsername('a'.repeat(USERNAME_MIN_LENGTH))).toBe('ok');
	});

	it('rejects names longer than the maximum', () => {
		expect(validateUsername('a'.repeat(USERNAME_MAX_LENGTH + 1))).toBe('too_long');
	});

	it('accepts a name exactly at the maximum length', () => {
		expect(validateUsername('a'.repeat(USERNAME_MAX_LENGTH))).toBe('ok');
	});

	it('measures length in code points, not UTF-16 units (matches PocketBase runes)', () => {
		// U+20000 is a supplementary-plane letter: 1 code point, 2 UTF-16 units.
		const name = '\u{20000}'.repeat(USERNAME_MAX_LENGTH);
		expect(name.length).toBe(USERNAME_MAX_LENGTH * 2); // UTF-16 units
		expect(validateUsername(name)).toBe('ok');
		expect(validateUsername('\u{20000}'.repeat(USERNAME_MAX_LENGTH + 1))).toBe('too_long');
	});

	it('rejects disallowed characters', () => {
		expect(validateUsername('user@name')).toBe('invalid');
		expect(validateUsername('bad/slash')).toBe('invalid');
	});

	it('rejects a leading dot or hyphen', () => {
		expect(validateUsername('.hidden')).toBe('invalid');
		expect(validateUsername('-dash')).toBe('invalid');
	});
});
