/**
 * App-wide toast notifications.
 *
 * A single host (`ToastHost.svelte`, mounted once in the root layout) renders
 * whatever is pushed here as a small popup at the bottom of the screen,
 * overlaying the rest of the app — so success/error feedback is visible without
 * scrolling back up to an inline alert. Push a toast from anywhere with
 * `pushToast(...)`.
 */

export type ToastType = 'success' | 'error' | 'warn';

export interface Toast {
	id: number;
	type: ToastType;
	message: string;
}

/** Default time (ms) a toast stays visible before auto-dismissing. */
const DEFAULT_DURATION = 4000;

/** Max toasts shown at once; older ones are dropped so they can't cover the screen. */
const MAX_TOASTS = 3;

class ToastStore {
	toasts = $state<Toast[]>([]);
	#nextId = 0;
	#timers = new Map<number, ReturnType<typeof setTimeout>>();

	/** Show a toast. Returns its id so callers can dismiss it early if needed. */
	push(type: ToastType, message: string, duration = DEFAULT_DURATION): number {
		const id = this.#nextId++;
		this.toasts.push({ id, type, message });
		// Cap the stack: drop the oldest so a burst of toasts can't bury the UI.
		while (this.toasts.length > MAX_TOASTS) {
			this.dismiss(this.toasts[0].id);
		}
		if (duration > 0) {
			this.#timers.set(
				id,
				setTimeout(() => this.dismiss(id), duration)
			);
		}
		return id;
	}

	dismiss(id: number): void {
		const timer = this.#timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.#timers.delete(id);
		}
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}
}

export const toastStore = new ToastStore();

/** Convenience helper mirroring the CustomAlert `type` prop. */
export function pushToast(
	type: ToastType,
	message: string,
	duration?: number
): number {
	return toastStore.push(type, message, duration);
}
