import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toastStore, pushToast } from './toast.svelte';

describe('toast store', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Singleton — clear any toasts left by a previous test.
		for (const t of [...toastStore.toasts]) toastStore.dismiss(t.id);
	});
	afterEach(() => vi.useRealTimers());

	it('push adds a toast and returns its id', () => {
		const id = pushToast('success', 'Gespeichert');
		expect(toastStore.toasts.at(-1)).toMatchObject({
			id,
			type: 'success',
			message: 'Gespeichert',
		});
	});

	it('auto-dismisses after the given duration', () => {
		pushToast('error', 'Fehler', 1000);
		expect(toastStore.toasts.length).toBe(1);
		vi.advanceTimersByTime(1000);
		expect(toastStore.toasts.length).toBe(0);
	});

	it('caps the stack at 3, dropping the oldest', () => {
		pushToast('success', 'a', 0);
		pushToast('success', 'b', 0);
		pushToast('success', 'c', 0);
		pushToast('success', 'd', 0);
		expect(toastStore.toasts.map((t) => t.message)).toEqual(['b', 'c', 'd']);
	});

	it('dismiss removes a specific toast', () => {
		const id = pushToast('warn', 'weg', 0);
		toastStore.dismiss(id);
		expect(toastStore.toasts.find((t) => t.id === id)).toBeUndefined();
	});
});
