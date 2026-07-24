import type { Action } from 'svelte/action';

/**
 * Locks the document while a conversation route is mounted so the page itself can
 * never scroll: the chat is a fixed-height app shell, and a scrollable document is
 * what let the mobile keyboard scroll the whole page down (revealing the footer)
 * instead of just reflowing the chat. The footer and the root <main> padding still
 * exist in flow but are simply clipped below the fold. Scoped here (rather than in
 * the root layout) via mount/destroy, the same pattern modals use for scroll-locking.
 */
export const scrollLock: Action<HTMLElement> = () => {
	const html = document.documentElement;
	const body = document.body;
	const prevHtml = html.style.overflow;
	const prevBody = body.style.overflow;
	// Reset to the top before locking: on a cold load the document can already be
	// scrolled down (e.g. the input focus dragging the too-tall page into view), and
	// locking `overflow: hidden` would otherwise freeze it there — footer showing,
	// view trapped (#529). The input now focuses with preventScroll, this is the belt.
	window.scrollTo(0, 0);
	html.style.overflow = 'hidden';
	body.style.overflow = 'hidden';
	return {
		destroy() {
			html.style.overflow = prevHtml;
			body.style.overflow = prevBody;
		},
	};
};

/**
 * Size the chat container to fill the *visual* viewport below the navbar.
 * Using visualViewport.height (rather than 100dvh) means the on-screen mobile
 * keyboard shrinks the container: the message list (flex-1) absorbs the shrink
 * and the input bar rides up just above the keyboard, matching native chat apps.
 * The scroll-lock above keeps the page itself from scrolling, so the keyboard only
 * reflows this container.
 * On a cold load (push/share link, reload) the mobile visual viewport isn't settled
 * yet — the browser toolbar is still expanded, so a single mount-time measurement
 * fixes too small a height and the scroll-lock stops a correcting event from firing.
 * So we re-measure across the settle window: after first paint (rAF), after the
 * toolbar collapses (timeout), and on window `load` / `orientationchange`, on top of
 * the live resize/scroll listeners. On internal navigation the viewport is already
 * settled → the extra passes are harmless no-ops.
 */
export const viewportHeight: Action<HTMLElement> = (node) => {
	const vv = window.visualViewport;

	const update = () => {
		const top = node.getBoundingClientRect().top + window.scrollY;
		const height = vv ? vv.height : window.innerHeight;
		node.style.height = `${height - top}px`;
	};

	update();
	const rafId = requestAnimationFrame(update);
	const timeoutId = setTimeout(update, 250);
	window.addEventListener('load', update);
	window.addEventListener('orientationchange', update);
	window.addEventListener('resize', update);
	vv?.addEventListener('resize', update);
	vv?.addEventListener('scroll', update);
	return {
		destroy() {
			cancelAnimationFrame(rafId);
			clearTimeout(timeoutId);
			window.removeEventListener('load', update);
			window.removeEventListener('orientationchange', update);
			window.removeEventListener('resize', update);
			vv?.removeEventListener('resize', update);
			vv?.removeEventListener('scroll', update);
		},
	};
};
