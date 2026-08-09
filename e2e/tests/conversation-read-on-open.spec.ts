import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { STORAGE_STATE, VIEWER_STORAGE_STATE } from '../fixtures/users';

/**
 * Regression for #412 — a conversation must NOT be marked read on mere hover.
 *
 * `app.html` sets `data-sveltekit-preload-data="hover"`, so hovering a conversation link
 * runs the route's `load()`. Read-marking used to live in `load()`, so a hover flipped the
 * thread to read without it ever being opened. Read-marking now happens only via the
 * `markRead` form action fired from the page once it is actually opened.
 *
 * Flow: the viewer requests "E2E Beamer" (reserved for this spec — see the e2e seed) to
 * create a fresh conversation that is unread for the owner. The owner then hovers the
 * conversation in the list (waiting for the preload `__data.json` to actually run
 * server-side) and it must stay unread; opening it must mark it read.
 *
 * The second test covers the other half of the contract, on its own reserved item ("E2E
 * Leinwand") so both tests can run in parallel without sharing a conversation: while the
 * thread is open, a message from the chat partner flips the reader's read flag back to false
 * server-side, so the page must re-assert read-state from the realtime event instead of
 * leaving the thread unread.
 *
 * The unread state exposes a semantic handle: an `sr-only` "Ungelesen" label inside the
 * conversation list row (ConversationListItem.svelte), so we locate the conversation by its
 * link role/name and detect unread via that label — no CSS class selectors.
 */

const ITEM = 'E2E Beamer';
// A second reserved item, so the two tests never share a conversation (they run in parallel).
const ITEM_OPEN_THREAD = 'E2E Leinwand';
// The sr-only label rendered inside a conversation list row while it is unread
// (ConversationListItem.svelte → texts.pages.conversations.unread).
const UNREAD_LABEL = 'Ungelesen';

test.describe('conversation read-on-open (not on hover) — #412', () => {
	let ownerCtx: BrowserContext;
	let viewerCtx: BrowserContext;
	let owner: Page;
	let viewer: Page;

	test.beforeEach(async ({ browser }) => {
		ownerCtx = await browser.newContext({ storageState: STORAGE_STATE });
		viewerCtx = await browser.newContext({
			storageState: VIEWER_STORAGE_STATE,
		});
		owner = await ownerCtx.newPage();
		viewer = await viewerCtx.newPage();
	});

	test.afterEach(async () => {
		await ownerCtx.close();
		await viewerCtx.close();
	});

	/**
	 * Counts the `markRead` action calls a page makes, to pin down that read-marking cannot fan
	 * out. Opening an unread thread costs up to two (the mount request plus one follow-up for
	 * the presence heartbeat's echo of the pre-request state) and every further signal is
	 * coalesced into at most one more — see readMarker.ts for why that echo is answered rather
	 * than suppressed.
	 */
	function countMarkRead(page: Page): () => number {
		let n = 0;
		page.on('response', (r) => {
			if (r.url().includes('markRead')) n++;
		});
		return () => n;
	}

	/**
	 * Deliberate fixed wait: these assertions are about the ABSENCE of a further request, and
	 * there is no event to wait for. The echo that used to trigger a redundant markRead arrives
	 * within ~10 ms of the mount (measured), so a second is three orders of magnitude of slack —
	 * without waiting for the next 15 s heartbeat tick.
	 */
	async function settleAfterOpen(page: Page): Promise<void> {
		await page.waitForTimeout(1000);
	}

	/** Matches the markRead POST response for `convId` — used to wait for read-marking to land. */
	function markReadResponse(page: Page, convId: string) {
		return page.waitForResponse(
			(r) =>
				r.url().includes(`/conversations/${convId}`) &&
				r.url().includes('markRead')
		);
	}

	/** True if `url` is `convId`'s hover-preload `__data.json` response. */
	function isPreloadResponse(url: string, convId: string): boolean {
		return (
			url.includes(`/conversations/${convId}`) && url.includes('__data.json')
		);
	}

	test('hovering a conversation link keeps it unread; opening it marks it read', async () => {
		const markReads = countMarkRead(owner);

		// Borrower requests the owner's item → fresh conversation, unread for the owner.
		await viewer.goto('/search?q=' + encodeURIComponent(ITEM));
		await viewer.getByRole('link', { name: ITEM }).first().click();
		await expect(viewer).toHaveURL(/\/items\/[^/]+$/);
		await viewer.getByRole('button', { name: 'Anfragen' }).click();
		await expect(viewer).toHaveURL(/\/conversations\/[^/]+$/);
		const convId = new URL(viewer.url()).pathname.split('/').pop()!;

		// Owner opens the conversation list; the new thread is present and UNREAD.
		await owner.goto('/conversations');
		const convLink = owner.getByRole('link', { name: ITEM });
		await expect(convLink).toBeVisible();
		await expect(convLink.getByText(UNREAD_LABEL)).toHaveCount(1);

		// Hover the link and wait until the hover-preload load() has actually run on the
		// server (its __data.json response). Pre-fix this is exactly what marked the thread
		// read; post-fix load() is read-only.
		//
		// A single hover is not reliable in dev-mode CI: SvelteKit only attaches its preload
		// `mousemove` listener (20 ms debounce) once client hydration finishes, and the SSR list
		// is visible (and hoverable) before that. Hovering right away can land before hydration
		// completes; since the mouse never moves again afterwards, the preload then never fires
		// and waitForResponse would time out. Poll instead: move the mouse away and re-hover on
		// every iteration so each pass produces fresh mousemove events, until the first
		// post-hydration pass actually triggers the preload.
		let preloadFired = false;
		owner.on('response', (r) => {
			if (isPreloadResponse(r.url(), convId)) preloadFired = true;
		});
		await expect
			.poll(
				async () => {
					await owner.mouse.move(0, 0);
					await convLink.hover();
					return preloadFired;
				},
				{ timeout: 15_000 }
			)
			.toBe(true);

		// Reload the list from the server: the thread must still be UNREAD (the regression).
		await owner.reload();
		const convLinkAfterHover = owner.getByRole('link', { name: ITEM });
		await expect(convLinkAfterHover).toBeVisible();
		await expect(convLinkAfterHover.getByText(UNREAD_LABEL)).toHaveCount(1);

		// Now actually OPEN the conversation. The page fires the markRead action; wait for it.
		await Promise.all([
			markReadResponse(owner, convId),
			convLinkAfterHover.click(),
		]);
		await expect(owner).toHaveURL(new RegExp(`/conversations/${convId}$`));

		// The hover contributed nothing, and the open did not fan out: the mount request plus at
		// most one coalesced follow-up.
		await settleAfterOpen(owner);
		expect(markReads()).toBeGreaterThanOrEqual(1);
		expect(markReads()).toBeLessThanOrEqual(2);

		// Back on the list (reloaded from the server) the thread is now READ — no unread label.
		await owner.goto('/conversations');
		const convLinkRead = owner.getByRole('link', { name: ITEM });
		await expect(convLinkRead).toBeVisible();
		await expect(convLinkRead.getByText(UNREAD_LABEL)).toHaveCount(0);
	});

	test('a message arriving while the thread is open leaves it read', async () => {
		// Regression for the follow-up found in review: `sendMessage` flips the recipient's
		// read flag to false server-side, and the open-mark only runs when the page mounts —
		// so a message arriving while the recipient is reading the thread made it pop back to
		// unread and stay there. The page now re-asserts read-state from the realtime event.
		const markReads = countMarkRead(owner);

		await viewer.goto('/search?q=' + encodeURIComponent(ITEM_OPEN_THREAD));
		await viewer.getByRole('link', { name: ITEM_OPEN_THREAD }).first().click();
		await expect(viewer).toHaveURL(/\/items\/[^/]+$/);
		await viewer.getByRole('button', { name: 'Anfragen' }).click();
		await expect(viewer).toHaveURL(/\/conversations\/[^/]+$/);
		const convId = new URL(viewer.url()).pathname.split('/').pop()!;

		// Owner opens the thread (direct URL) — that marks it read.
		await Promise.all([
			markReadResponse(owner, convId),
			owner.goto(`/conversations/${convId}`),
		]);

		// With the owner's page still open, the viewer sends a message. The owner's client gets
		// the realtime `conversations` update whose read flag is now false, and re-fires markRead.
		const text = `E2E Nachricht ${convId}`;
		const remarked = markReadResponse(owner, convId);
		await viewer.locator('input[name="messageContent"]').fill(text);
		await viewer
			.locator('form[action="?/sendMessage"] button[type="submit"]')
			.click();

		// The message reaches the open thread (realtime works) and the re-mark POST ran.
		await expect(owner.getByText(text)).toBeVisible();
		await remarked;

		// No fan-out: the open (up to two) plus one coalesced re-mark for the message.
		await settleAfterOpen(owner);
		expect(markReads()).toBeGreaterThanOrEqual(2);
		expect(markReads()).toBeLessThanOrEqual(4);

		// Server truth: the thread is READ for the owner despite the new message.
		await owner.goto('/conversations');
		const convLink = owner.getByRole('link', { name: ITEM_OPEN_THREAD });
		await expect(convLink).toBeVisible();
		await expect(convLink.getByText(UNREAD_LABEL)).toHaveCount(0);
	});
});
