import type { Action } from 'svelte/action';

function scrollToBottom(node: HTMLElement, smooth: boolean) {
	node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

/**
 * Keeps the messages list (`node`) stuck to the bottom.
 *
 * `messages` is the page's current message array — pass it directly (e.g.
 * `use:stickToBottom={messages.value}`) so the action's `update()` re-runs whenever it's
 * reassigned (new message arrives, `use:enhance` reload, realtime sync, …), scrolling to
 * bottom exactly when the original inline `$effect` did.
 *
 * On top of that, this also re-anchors to the bottom when the visual viewport resizes/
 * loads/rotates — e.g. when the mobile keyboard opens and the layout shrinks the chat
 * container. The container is resized by the layout's own resize handler, which runs in
 * the same event; scrolling synchronously here would target the pre-resize height (a
 * no-op) and leave the latest messages hidden below the raised input bar. Defer with rAF
 * so we scroll after the resize + reflow, then once more after the open/close animation
 * settles. Also re-scroll after the layout's cold-load height correction (push/share
 * link, reload): that correction fires on window `load` / `orientationchange` — not
 * necessarily via a vv resize — so mirror those triggers here to land at the bottom once
 * the container has grown to its settled height.
 */
export const stickToBottom: Action<HTMLElement, unknown[] | undefined> = (node, messages) => {
	// Scroll chat window to bottom when messages change.
	if (messages && messages.length > 0) {
		setTimeout(() => scrollToBottom(node, true), 0);
	}

	const vv = window.visualViewport;
	let settleTimer: ReturnType<typeof setTimeout>;
	const keepAtBottom = () => {
		requestAnimationFrame(() => scrollToBottom(node, false));
		clearTimeout(settleTimer);
		settleTimer = setTimeout(() => scrollToBottom(node, false), 150);
	};
	vv?.addEventListener('resize', keepAtBottom);
	window.addEventListener('load', keepAtBottom);
	window.addEventListener('orientationchange', keepAtBottom);

	return {
		update(newMessages) {
			if (newMessages && newMessages.length > 0) {
				setTimeout(() => scrollToBottom(node, true), 0);
			}
		},
		destroy() {
			vv?.removeEventListener('resize', keepAtBottom);
			window.removeEventListener('load', keepAtBottom);
			window.removeEventListener('orientationchange', keepAtBottom);
			clearTimeout(settleTimer);
		},
	};
};
