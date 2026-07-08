/** Prefix added to the description of items no longer present in a partner's source feed. */
export const DESCRIPTION_PREFIX = '[Nicht mehr im Bestand] ';

/** Prefixes a description to mark the item as archived, unless already prefixed. */
export function archiveDescription(description: string | null | undefined): string {
	return description?.startsWith(DESCRIPTION_PREFIX)
		? description
		: `${DESCRIPTION_PREFIX}${description ?? ''}`;
}

/** Extracts a human-readable message from a PocketBase ClientResponseError-like object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pbErrorMessage(err: any): string {
	const fieldErrors: Record<string, { message?: string }> =
		err?.response?.data ?? err?.data?.data ?? {};
	const fields = Object.entries(fieldErrors)
		.map(([k, v]) => `${k}: ${v?.message ?? JSON.stringify(v)}`)
		.join(', ');
	if (fields) return fields;
	return err?.data?.message ?? err?.message ?? String(err);
}
