import { fail, redirect } from '@sveltejs/kit';
import type { ClientResponseError } from 'pocketbase';
import { texts } from '$lib/texts';
import { getOutstandingLegalDocs, isLegalLocked, type LegalUser } from '$lib/server/legal';
import { getActiveLegalDocs, getActiveLegalVersions } from '$lib/server/legalDocs';

/** Only follow same-origin, absolute-path redirect targets (no open redirect).
 *  Rejects scheme-relative (`//host`) AND backslash (`/\host`, which browsers
 *  normalise to `//host`) targets — review #6. */
function safeRedirect(target: string | null): string {
	if (target && target.startsWith('/') && target[1] !== '/' && target[1] !== '\\') return target;
	return '/';
}

export async function load({ locals, url }) {
	if (!locals.user) {
		redirect(307, `/auth/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}
	const user = locals.user as unknown as LegalUser;
	const redirectTo = safeRedirect(url.searchParams.get('redirectTo'));

	const versions = await getActiveLegalVersions(locals.pb);
	const outstanding = getOutstandingLegalDocs(user, versions);
	const locked = isLegalLocked(user);

	// Fully consented and not locked → the gate would no longer stop them.
	if (outstanding.length === 0 && !locked) {
		redirect(303, redirectTo);
	}

	// Show the documents that need (re-)confirming: the outstanding ones, or — for a
	// locked user self-recovering — every active document, since their cached version
	// may already match yet they must re-affirm to clear the lock (review #3/#9).
	const activeDocs = await getActiveLegalDocs(locals.pb);
	const shown = locked
		? activeDocs
		: activeDocs.filter((d) => outstanding.some((o) => o.docType === d.docType));

	return {
		redirectTo,
		// The gate always appends ?redirectTo=… when it bounces a user here; its mere
		// presence (even for `/`) means "you were stopped", vs. a direct visit (review #10).
		fromGate: url.searchParams.has('redirectTo'),
		docs: shown.map((d) => ({
			docType: d.docType,
			version: d.version,
			effectiveDate: d.effectiveDate,
			body: d.body,
			name: texts.legal.docName(d.docType)
		}))
	};
}

export const actions = {
	accept: async ({ locals, request, url }) => {
		if (!locals.user) {
			redirect(307, `/auth/login?redirectTo=${encodeURIComponent('/legal/accept')}`);
		}
		const user = locals.user as unknown as LegalUser;
		const redirectTo = safeRedirect(url.searchParams.get('redirectTo'));
		const versions = await getActiveLegalVersions(locals.pb);
		const outstanding = getOutstandingLegalDocs(user, versions);
		const locked = isLegalLocked(user);

		if (outstanding.length === 0 && !locked) {
			redirect(303, redirectTo);
		}

		// Require an explicit tick for each shown document (all active docs for a
		// locked user, otherwise just the outstanding ones).
		const required = locked ? Object.keys(versions) : outstanding.map((d) => d.docType);
		const formData = await request.formData();
		const allConfirmed = required.every((dt) => formData.get(`confirm_${dt}`) === 'on');
		if (!allConfirmed) {
			return fail(400, { error: true, message: texts.legal.accept.errors.mustAcceptAll });
		}

		try {
			// Server-authoritative: the backend hook writes the audit records (snapshot
			// from the active document), refreshes the version cache and clears any lock
			// — all in superuser context, so none of it is client-forgeable (review #2).
			await locals.pb.send('/api/legal/accept', { method: 'POST' });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			console.error('legal acceptance failed:', e?.message ?? err);
			return fail(500, { error: true, message: texts.legal.accept.errors.saveFailed });
		}

		redirect(303, redirectTo);
	},

	decline: async ({ locals }) => {
		if (!locals.user) {
			redirect(307, `/auth/login?redirectTo=${encodeURIComponent('/legal/accept')}`);
		}
		try {
			// Decline + account lock run in the backend hook (superuser context).
			await locals.pb.send('/api/legal/decline', { method: 'POST' });
		} catch (err) {
			const e = err as Partial<ClientResponseError>;
			console.error('legal decline failed:', e?.message ?? err);
			return fail(500, { error: true, message: texts.legal.accept.errors.declineFailed });
		}

		redirect(303, '/legal/locked');
	}
};
