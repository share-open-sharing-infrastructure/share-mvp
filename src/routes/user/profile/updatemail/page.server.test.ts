import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actions } from './+page.server';

type ActionEvent = Parameters<typeof actions.updatemail>[0];

describe('Update-email page action', () => {
	let requestEmailChange: ReturnType<typeof vi.fn>;
	let mockLocals: { pb: { collection: ReturnType<typeof vi.fn> } };

	beforeEach(() => {
		vi.clearAllMocks();
		requestEmailChange = vi.fn().mockResolvedValue(undefined);
		mockLocals = {
			pb: { collection: vi.fn(() => ({ requestEmailChange })) },
		};
	});

	function buildRequest(fields: Record<string, string>) {
		const data = new FormData();
		for (const [key, value] of Object.entries(fields)) data.append(key, value);
		return { formData: vi.fn().mockResolvedValue(data) };
	}

	function callUpdate(request: ReturnType<typeof buildRequest>) {
		return actions.updatemail({ locals: mockLocals, request } as unknown as ActionEvent);
	}

	it('normalizes a mixed-case/whitespace email before requesting the change (#557)', async () => {
		const result = await callUpdate(buildRequest({ newEmail: '  Julika7@Example.com ' }));

		expect(requestEmailChange).toHaveBeenCalledWith('julika7@example.com');
		expect(result).toMatchObject({ success: true });
		// The confirmation message reflects the normalized address.
		expect((result as { message: string }).message).toContain('julika7@example.com');
		expect((result as { message: string }).message).not.toContain('Julika7');
	});

	it('fails with 400 when newEmail is missing', async () => {
		const result = await callUpdate(buildRequest({}));
		expect((result as { status?: number })?.status).toBe(400);
		expect(requestEmailChange).not.toHaveBeenCalled();
	});
});
