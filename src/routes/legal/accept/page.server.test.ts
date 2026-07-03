import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions, load } from './+page.server';
import { _resetLegalVersionCache } from '$lib/server/legalDocs';
import { texts } from '$lib/texts';

// SvelteKit's redirect()/error() throw; capture the thrown value for assertions.
async function capture(fn: () => unknown): Promise<{ status: number; location?: string }> {
	try {
		await fn();
	} catch (e) {
		return e as { status: number; location?: string };
	}
	throw new Error('expected a thrown redirect, but none was thrown');
}

// The active documents the mocked `legal_documents` collection returns.
const ACTIVE_DOCS = [
	{ docType: 'tos', version: '1.3', title: 'AGB', effectiveDate: '23. Juni 2026', body: '<p>tos</p>' },
	{ docType: 'privacy', version: '2.9', title: 'DS', effectiveDate: '25. Juni 2026', body: '<p>priv</p>' }
];

beforeEach(() => _resetLegalVersionCache());

function makeEvent(opts: {
	user: Record<string, unknown> | null;
	form?: Record<string, string>;
	redirectTo?: string;
	send?: (...args: unknown[]) => unknown;
}) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(opts.form ?? {})) fd.set(k, v);
	const search = opts.redirectTo ? `?redirectTo=${encodeURIComponent(opts.redirectTo)}` : '';
	const pb = {
		collection: vi.fn((name: string) => {
			if (name === 'legal_documents') {
				return { getFullList: vi.fn(async () => ACTIVE_DOCS) };
			}
			return {};
		}),
		send: vi.fn(opts.send ?? (async () => ({})))
	};
	return {
		locals: { pb, user: opts.user },
		url: new URL(`http://localhost/legal/accept${search}`),
		request: { formData: async () => fd, headers: { get: () => 'agent/1.0' } },
		getClientAddress: () => '1.2.3.4',
		__pb: pb
	} as unknown as Parameters<typeof actions.accept>[0];
}

const asLoad = (e: ReturnType<typeof makeEvent>) => e as unknown as Parameters<typeof load>[0];
const sendOf = (e: ReturnType<typeof makeEvent>) => (e as unknown as { __pb: { send: ReturnType<typeof vi.fn> } }).__pb.send;

const freshUser = { id: 'u1' }; // no accepted versions → both docs outstanding

describe('load', () => {
	it('lets a locked user reach the page to self-recover (shows all active docs)', async () => {
		const data = await load(asLoad(makeEvent({ user: { id: 'u1', legalLocked: true } })));
		expect(data.docs.map((d) => d.docType)).toEqual(['tos', 'privacy']);
	});

	it('redirects an already-consented user to their target', async () => {
		const user = { id: 'u1', tosAcceptedVersion: '1.3', privacyAcceptedVersion: '2.9' };
		const r = await capture(() => load(asLoad(makeEvent({ user, redirectTo: '/search' }))));
		expect(r).toMatchObject({ status: 303, location: '/search' });
	});

	it('returns the outstanding docs for a fresh user and flags the gate redirect', async () => {
		const data = await load(asLoad(makeEvent({ user: freshUser, redirectTo: '/' })));
		expect(data.docs.map((d) => d.docType)).toEqual(['tos', 'privacy']);
		expect(data.fromGate).toBe(true);
	});
});

describe('accept action', () => {
	it('calls the backend accept endpoint and redirects when all boxes are checked', async () => {
		const event = makeEvent({
			user: freshUser,
			form: { confirm_tos: 'on', confirm_privacy: 'on' },
			redirectTo: '/items/abc'
		});
		const r = await capture(() => actions.accept(event));
		expect(r).toMatchObject({ status: 303, location: '/items/abc' });
		expect(sendOf(event)).toHaveBeenCalledWith('/api/legal/accept', expect.objectContaining({ method: 'POST' }));
	});

	it('fails (no endpoint call) when a document is left unchecked', async () => {
		const event = makeEvent({ user: freshUser, form: { confirm_tos: 'on' } });
		const result = await actions.accept(event);
		expect(result).toMatchObject({ status: 400, data: { error: true, message: texts.legal.accept.errors.mustAcceptAll } });
		expect(sendOf(event)).not.toHaveBeenCalled();
	});

	it('lets a locked user re-affirm all active docs to recover', async () => {
		const event = makeEvent({
			user: { id: 'u1', legalLocked: true },
			form: { confirm_tos: 'on', confirm_privacy: 'on' }
		});
		const r = await capture(() => actions.accept(event));
		expect(r.status).toBe(303);
		expect(sendOf(event)).toHaveBeenCalledWith('/api/legal/accept', expect.objectContaining({ method: 'POST' }));
	});

	it('rejects a scheme-relative open-redirect target, falling back to home', async () => {
		const event = makeEvent({
			user: freshUser,
			form: { confirm_tos: 'on', confirm_privacy: 'on' },
			redirectTo: 'https://evil.test'
		});
		const r = await capture(() => actions.accept(event));
		expect(r.location).toBe('/');
	});

	it('rejects a backslash open-redirect target (/\\evil.com), falling back to home (#6)', async () => {
		const event = makeEvent({
			user: freshUser,
			form: { confirm_tos: 'on', confirm_privacy: 'on' },
			redirectTo: '/\\evil.com'
		});
		const r = await capture(() => actions.accept(event));
		expect(r.location).toBe('/');
	});
});

describe('decline action', () => {
	it('calls the backend decline endpoint and redirects to the locked page', async () => {
		const event = makeEvent({ user: freshUser, send: vi.fn(async () => ({ locked: true })) });
		const r = await capture(() => actions.decline(event));
		expect(r).toMatchObject({ status: 303, location: '/legal/locked' });
		expect(sendOf(event)).toHaveBeenCalledWith('/api/legal/decline', expect.objectContaining({ method: 'POST' }));
	});
});
