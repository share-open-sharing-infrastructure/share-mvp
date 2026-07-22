import { describe, it, expect, vi } from 'vitest';
import { mockFilter, makeMockPb } from './test-helpers';

describe('mockFilter', () => {
	it('returns raw unchanged when no params are given', () => {
		expect(mockFilter('id = {:id}')).toBe('id = {:id}');
	});

	it('quotes and escapes string params', () => {
		expect(mockFilter('name = {:name}', { name: "O'Brien" })).toBe("name = 'O\\'Brien'");
	});

	it('leaves numbers and booleans unquoted', () => {
		expect(mockFilter('count > {:n} && active = {:b}', { n: 3, b: true })).toBe(
			'count > 3 && active = true'
		);
	});

	it('substitutes every occurrence of a repeated placeholder', () => {
		expect(mockFilter('a = {:x} || b = {:x}', { x: 'v1' })).toBe("a = 'v1' || b = 'v1'");
	});

	it('leaves unknown placeholders untouched', () => {
		expect(mockFilter('a = {:known} && b = {:unknown}', { known: 'v' })).toBe(
			"a = 'v' && b = {:unknown}"
		);
	});
});

describe('makeMockPb', () => {
	it('dispatches collection() to the matching impl', () => {
		const getOne = vi.fn().mockResolvedValue({ id: 'item1' });
		const pb = makeMockPb({ items: { getOne } });

		expect(pb.collection('items')).toEqual({ getOne });
	});

	it('returns undefined for an unstubbed collection', () => {
		const pb = makeMockPb({ items: { getOne: vi.fn() } });

		expect(pb.collection('conversations')).toBeUndefined();
	});

	it('exposes pb.filter as an assertable spy delegating to mockFilter', () => {
		const pb = makeMockPb({});

		const result = pb.filter('id = {:id}', { id: 'abc' });

		expect(result).toBe("id = 'abc'");
		expect(pb.filter).toHaveBeenCalledWith('id = {:id}', { id: 'abc' });
	});
});
