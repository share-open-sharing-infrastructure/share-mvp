import { resolve } from '$app/paths';

export interface SearchUrlParams {
	q?: string;
	cats?: string[];
	onlyAvailable?: boolean;
	ownerType?: string;
	group?: string;
	sort?: string;
	page?: number;
	perPage?: number;
}

export function buildSearchUrl(params: SearchUrlParams): string {
	const parts: string[] = [];
	if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
	if (params.page !== undefined && params.page > 1) parts.push(`page=${params.page}`);
	if (params.perPage !== undefined) parts.push(`perPage=${params.perPage}`);
	if (params.cats && params.cats.length > 0) parts.push(`cats=${encodeURIComponent(params.cats.join(','))}`);
	if (params.onlyAvailable) parts.push('onlyAvailable=true');
	if (params.ownerType && params.ownerType !== 'all') parts.push(`ownerType=${params.ownerType}`);
	if (params.group) parts.push(`group=${encodeURIComponent(params.group)}`);
	if (params.sort && params.sort !== 'newest') parts.push(`sort=${encodeURIComponent(params.sort)}`);
	// Query goes inside resolve() (SvelteKit passes search/hash through since 2.26), so the
	// return value is a single resolve() call — an already-resolved, ready-to-navigate URL. The
	// branch keeps the type a valid `/search?…` pathname (a bare `/search${string}` is too broad).
	const query = parts.join('&');
	return query ? resolve(`/search?${query}`) : resolve('/search');
}
