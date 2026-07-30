import {
	test,
	expect,
	type BrowserContext,
	type Page,
} from '@playwright/test';
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
		viewerCtx = await browser.newContext({ storageState: VIEWER_STORAGE_STATE });
		owner = await ownerCtx.newPage();
		viewer = await viewerCtx.newPage();
	});

	test.afterEach(async () => {
		await ownerCtx.close();
		await viewerCtx.close();
	});

	test('hovering a conversation link keeps it unread; opening it marks it read', async () => {
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
		await Promise.all([
			owner.waitForResponse(
				(r) => r.url().includes(`/conversations/${convId}`) && r.url().includes('__data.json')
			),
			convLink.hover(),
		]);

		// Reload the list from the server: the thread must still be UNREAD (the regression).
		await owner.reload();
		const convLinkAfterHover = owner.getByRole('link', { name: ITEM });
		await expect(convLinkAfterHover).toBeVisible();
		await expect(convLinkAfterHover.getByText(UNREAD_LABEL)).toHaveCount(1);

		// Now actually OPEN the conversation. The page fires the markRead action; wait for it.
		await Promise.all([
			owner.waitForResponse(
				(r) => r.url().includes(`/conversations/${convId}`) && r.url().includes('markRead')
			),
			convLinkAfterHover.click(),
		]);
		await expect(owner).toHaveURL(new RegExp(`/conversations/${convId}$`));

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
		await viewer.goto('/search?q=' + encodeURIComponent(ITEM_OPEN_THREAD));
		await viewer.getByRole('link', { name: ITEM_OPEN_THREAD }).first().click();
		await expect(viewer).toHaveURL(/\/items\/[^/]+$/);
		await viewer.getByRole('button', { name: 'Anfragen' }).click();
		await expect(viewer).toHaveURL(/\/conversations\/[^/]+$/);
		const convId = new URL(viewer.url()).pathname.split('/').pop()!;

		// Owner opens the thread (direct URL) — that marks it read.
		await Promise.all([
			owner.waitForResponse(
				(r) => r.url().includes(`/conversations/${convId}`) && r.url().includes('markRead')
			),
			owner.goto(`/conversations/${convId}`),
		]);

		// With the owner's page still open, the viewer sends a message. The owner's client gets
		// the realtime `conversations` update whose read flag is now false, and re-fires markRead.
		const text = `E2E Nachricht ${convId}`;
		const remarked = owner.waitForResponse(
			(r) => r.url().includes(`/conversations/${convId}`) && r.url().includes('markRead')
		);
		await viewer.locator('input[name="messageContent"]').fill(text);
		await viewer.locator('form[action="?/sendMessage"] button[type="submit"]').click();

		// The message reaches the open thread (realtime works) and the re-mark POST ran.
		await expect(owner.getByText(text)).toBeVisible();
		await remarked;

		// Server truth: the thread is READ for the owner despite the new message.
		await owner.goto('/conversations');
		const convLink = owner.getByRole('link', { name: ITEM_OPEN_THREAD });
		await expect(convLink).toBeVisible();
		await expect(convLink.getByText(UNREAD_LABEL)).toHaveCount(0);
	});
});
