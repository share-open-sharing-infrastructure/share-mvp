---
name: add-notification-type
description: Wire up a new notification type end-to-end in AllerLeih (the NotificationType union, the German body string, the trigger site that creates + pushes it, and the in-app list routing/icon). Use whenever the user wants to add, send, or notify about a new event — e.g. "notify the owner when X happens", "add a notification for Y", "send a push when Z" — so the notification isn't half-wired (a created record with no push, or a push that links to a dead page).
---

# add-notification-type

Notifications span four places, and the classic failure is wiring only some of them — a record
with no push, a push with no in-app entry, or (worst) a link that 404s because `relatedId` and the
target URL disagree. This skill keeps all four in sync. A notification has two faces: an **in-app**
list entry (`notifications` collection) and a **web-push** message; most flows create both together.

The whole pipeline (see `src/lib/server/notifications.ts`, `src/routes/notifications/+page.svelte`,
`src/service-worker.ts`) is driven by two values you choose at the trigger site:
- **`relatedId`** — the id the notification points at (a conversation id, or a user id, …).
- **the target `url`** — the page a click should open, built from `relatedId`.

Get those two consistent with the in-app `notificationHref()` and everything else falls out.

## The four places to change

1. **Type union** — `src/lib/types/models.ts`, the `NotificationType` union (~line 358). Add your
   string literal (snake_case, like the existing `new_request`, `return_confirmed`).
2. **German body** — `src/lib/texts.ts`, the **`notifications` body block** (~line 824). Add a
   generator, e.g. `groupInvite: (from: string, group: string) => \`${from} hat dich zu „${group}" eingeladen\``.
   The body is **stored pre-formatted** on the record and rendered verbatim — never inline a string.
   Heads-up: there are **two** `notifications:` keys in `texts.ts` — a settings/permission sub-block
   (~line 592) and the message-body generators (~line 824, the top-level `texts.notifications`). A
   naive grep for `notifications:` lands on the settings one first; you want the body block.
3. **Trigger site** — wherever the event happens (a form action or a `$lib/server` helper). Create
   the record **and** push, together:
   ```ts
   import { createNotification, sendPushToUser } from '$lib/server/notifications';
   import { texts } from '$lib/texts';

   const body = texts.notifications.groupInvite(inviterName, groupName);
   const url = `/groups/${groupId}`;                 // where a click should land
   await createNotification(pb, recipientId, senderId, 'group_invite', groupId, body);
   await sendPushToUser(pb, recipientId, texts.notifications.pushTitle, body, url);
   ```
   `createNotification(pb, recipient, sender?, type, relatedId, body)` writes the in-app record
   (`read:false`, fails silently). `sendPushToUser(pb, userId, title, body, url)` pushes to every
   registered device and prunes stale subscriptions (HTTP 410/404). Always pass
   `texts.notifications.pushTitle` as the title. **`relatedId` here must match the `url`** (here both
   derive from `groupId`).
4. **In-app routing + icon** — `src/routes/notifications/+page.svelte`. `notificationHref()` maps a
   notification to its link. Either add your type to the `conversationNotificationTypes` set (if it
   points to a conversation → `/conversations/{relatedId}`), or add a branch (e.g.
   `n.type === 'group_invite'` → `/groups/{relatedId}`). Add a matching arm to the icon `{#if}` block
   too — a type with no arm silently renders **no icon** (it doesn't error, so it's easy to miss).
   **This href must produce the same destination as the push `url`** — otherwise the in-app link and
   the push go to different places, and a wrong `relatedId` dead-links.

## The consistency rule (the actual footgun)

`relatedId` → push `url` (trigger site) → `notificationHref()` (in-app list) must all agree. The
**service worker needs no change** — `notificationclick` just navigates to the `url` you passed at
push time (`src/service-worker.ts`), and it already suppresses a push if the user has that page
open. So the routing decision lives entirely in the `url` you build and the matching
`notificationHref()` branch. If they diverge, clicks 404.

## Email (backend) — only if you want it

In-app + push are frontend-only and need **no backend change**. The backend hook
(`allerleih-backend/pb_hooks/notification.pb.js`) sends *email* and currently fires only for
`new_message` (with throttling + an `emailNotifications` opt-out). If your new type should also email,
that's a separate change in the backend repo (a hook on the relevant collection + an HTML template in
`pb_hooks/views/mail/`) — call it out rather than assuming it happens automatically.

## Verify

- Add a Vitest test at the trigger site asserting `createNotification`/`sendPushToUser` are called
  with the right `type`, `relatedId`, and `url` (mock them; see the `write-tests` skill).
- Manually: trigger the event, confirm the entry appears at `/notifications` with the right text and
  that clicking it (and the push) lands on the intended page — not `/notifications` fallback or a 404.
