import { resolve } from '$app/paths';

export interface SearchUrlParams {
	q?: string;
	cats?: string[];
	op?: 'or' | 'and';
	onlyAvailable?: boolean;
	ownerType?: string;
	page?: number;
	perPage?: number;
}

export function buildSearchUrl(params: SearchUrlParams): string {
	const parts: string[] = [];
	if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
	if (params.page !== undefined && params.page > 1) parts.push(`page=${params.page}`);
	if (params.perPage !== undefined) parts.push(`perPage=${params.perPage}`);
	if (params.cats && params.cats.length > 0) parts.push(`cats=${encodeURIComponent(params.cats.join(','))}`);
	if (params.op === 'and') parts.push('op=and');
	if (params.onlyAvailable === false) parts.push('onlyAvailable=false');
	if (params.ownerType && params.ownerType !== 'all') parts.push(`ownerType=${params.ownerType}`);
	return resolve('/search') + (parts.length ? '?' + parts.join('&') : '');
}
