---
name: seed-scenario
description: Create a new deterministic seed scenario for AllerLeih's local PocketBase (a file under scripts/seed/scenarios/) so reviewers and you can populate a running instance with realistic test data for a feature. Use whenever the user asks to add seed data, create a seed scenario, set up test data for a PR/feature, or "make some data to click through" — anything about populating the local DB to exercise a flow, not about Vitest unit tests.
---

# seed-scenario

Add a named seed scenario so anyone can spin up realistic, deterministic data for a feature with
one command — invaluable for PR review and manual walkthroughs. Scenarios are **safe to ship**:
they only ever create users on the `@seed.test` domain and records those users own, and the runner
tears that data down before each run, so production is never touched and re-running is idempotent.

Model your scenario on the existing one: `scripts/seed/scenarios/account-deletion.js`. The factories
and constants live in `scripts/seed/lib.js`; the runner is `scripts/seed.js`.

## 1. Where it goes

One file per feature/PR: `scripts/seed/scenarios/<feature>.js` (kebab-case, e.g. `groups.js`,
`lending-lifecycle.js`). The runner **auto-discovers** it — no registration anywhere. The file name
(without `.js`) is the scenario name you pass on the command line.

## 2. Required exports

```js
import { createUser, createItem, createMessage, createConversation, setTrust, USER_PASSWORD, SEED_DOMAIN } from '../lib.js';

// One-line summary, printed by the runner.
export const description = 'Trust visibility: a trustees-only item is visible to a trusted user but hidden from everyone else.';

// Builds the data. `pb` is an authenticated superuser client. Optionally return a
// walkthrough string (logins + click-through steps) — the runner prints it on success.
export async function run(pb) {
  // …build data through the factories…
  return `  Login (password for all: "${USER_PASSWORD}"):\n    owner_seed${SEED_DOMAIN} · trusted_seed${SEED_DOMAIN}\n\n  Walkthrough:\n    1. …`;
}
```

## 3. Build everything through the factories

Use the helpers for users/items/messages/conversations so users land on the `@seed.test` domain
(the thing teardown keys off) and items get sane defaults. For collections the factories don't cover,
see **"When there's no factory"** below.

| Factory | Signature → returns | Notes |
|---|---|---|
| `createUser` | `(pb, username, overrides?)` → **record** | Makes `username@seed.test`, verified + onboarded, password `USER_PASSWORD`. Use a `_seed` suffix (`alice_seed`) to signal seed data and avoid clashing real usernames. `overrides` for extra fields (`isInstitution`, `city`, `bio`, …). |
| `createItem` | `(pb, ownerId, name, categories, opts?)` → **record** | `categories` is an **array of valid `ITEM_CATEGORIES`** strings from `src/lib/texts.ts` (e.g. `['Werkzeug und Garten']`). `opts`: `description`, `place`, `status`, `trusteesOnly`. **Images:** each item gets a generated colour placeholder PNG by default — pass `withImage: false` to skip it, or `image: <File/Blob>` to upload your own. |
| `createMessage` | `(pb, fromId, toId, content)` → **message id** (string, not a record) | Pass these ids into a conversation's `messages` array. |
| `createConversation` | `(pb, data)` → **record** | `data` is the full object: `requester`, `itemOwner`, `requestedItem`, `messages: [ids]`, `readByRequester`, `readByOwner`, `lendingStatus`. |
| `setTrust` | `(pb, userId, trustedIds[])` | Sets the user's `trusts[]`. Trust is directional — set both sides if you want mutual trust. |

`createUser`/`createItem`/`createConversation` return the **record** (use `.id`); `createMessage`
returns just the **id**. A conversation's `lendingStatus` is one of `pending`, `accepted`, `rejected`,
`active`, `return_requested`, `completed` (the `LendingStatus` type in `src/lib/types/models.ts`; a
fresh request starts `pending`) — see `docs/domain-model.md` for the lifecycle.

### When there's no factory

The factories only cover users, items, messages, conversations, and trust. Many features
(`groups`/`group_members`, `lending_terms`, `notifications`, `user_contacts`, …) have none — and for
those you **may** create records directly with `pb.collection(name).create(...)`. Two rules keep that
safe:

- **Reachable from a seed user.** `teardown()` only deletes `users`, `items`, `conversations`, and
  `messages` (plus whatever the backend `cascadeDelete`s when a seed user is removed). A record you
  create in any other collection survives re-runs and leaks **unless** deleting one of your
  `@seed.test` users cascades to it (e.g. a `group` owned by a seed user takes its `group_members`
  with it). If nothing cascades to it, it's orphaned — don't create it, or it'll pollute the next run.
- **Respect the real rules and hooks.** Your direct `create` runs against the live collection rules
  and `pb_hooks` — read the relevant backend hook first. They auto-create rows and enforce unique
  indexes: e.g. creating a `groups` record fires a hook that inserts the owner as an `admin`
  `group_member`, so adding the owner's membership yourself violates the unique `(group, user)` index
  and the seed crashes. Set only the rows the hook doesn't.

## 4. Idempotency: tie everything to seed users, run one at a time

Before any scenario runs, `teardown()` deletes **every** `@seed.test` user and their
messages/conversations/items. Two consequences:
- **Everything you create must belong to a seed user** (made via `createUser`). A record owned by a
  real user won't be cleaned up and will leak across runs.
- **Scenarios are independent and run one at a time** — never assume data from another scenario is
  present; build the full world your scenario needs.

## 5. Write a walkthrough

The most useful scenarios return a summary string with the logins and the exact click-through that
demonstrates the feature (see `account-deletion.js` for the shape). This is what a reviewer reads to
verify the PR, so make the steps concrete and ordered.

## 6. Run it

PocketBase must be running, and you need superuser credentials in the environment:

```bash
npm run seed                 # lists available scenarios
PB_SUPERUSER_EMAIL=you@example.com PB_SUPERUSER_PASSWORD=secret npm run seed -- <feature>
```

All seed users share the password `password123`; the runner prints the logins + your walkthrough on
success. `PB_URL` overrides the instance (default `http://127.0.0.1:8090`). Run your new scenario
once to confirm it seeds cleanly before committing.
