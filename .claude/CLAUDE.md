# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**AllerLeih** is an item-sharing platform. Users list items they are willing to share or lend, and browse and request items from others. A trust system lets owners restrict certain items to trusted users only; institutional accounts can bulk-import items and link out to external catalogues. The UI is entirely in German.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | SvelteKit 2 + Svelte 5 (runes) |
| Language | TypeScript (strict mode) |
| CSS | Tailwind CSS v4 + Flowbite Svelte components |
| Backend / DB | PocketBase (hosted SQLite, no migration files in repo) |
| Build tool | Vite |
| Testing | Vitest |
| Linting / formatting | ESLint (flat config) + Prettier |

## Key commands

```bash
npm run dev        # start dev server
npm run build      # production build
npm run preview    # preview production build
npm run check      # svelte-kit sync + svelte-check (type checking)
npm run lint       # ESLint
npm run lint:fix   # ESLint with auto-fix
npm run format     # Prettier
npm run test       # Vitest in WATCH mode
npx vitest run                       # run all tests once (CI-style)
npx vitest run src/path/to/file.test.ts  # run a single test file

# Seed a running PocketBase with deterministic test data. Scenarios live in
# scripts/seed/scenarios/ (one file per feature); shared helpers in scripts/seed/lib.js.
# Idempotent; only touches its own `@seed.test` records. Requires superuser creds.
npm run seed                                   # lists available scenarios
PB_SUPERUSER_EMAIL=you@example.com PB_SUPERUSER_PASSWORD=secret npm run seed -- account-deletion
```

## Environment variables

Required in `.env`:

```
PUBLIC_PB_URL=           # PocketBase instance URL
PUBLIC_VAPID_PUBLIC_KEY= # VAPID public key for push notifications
VAPID_PRIVATE_KEY=       # VAPID private key
VAPID_SUBJECT=           # VAPID subject (mailto: or https: URI)
ORS_API_KEY=             # OpenRouteService API key (geocoding + travel times)
MISTRAL_API_KEY=         # Mistral API key — AI item image analysis (production only)
```

## Project structure

```
src/
├── app.d.ts                    # Global types (locals, PageData)
├── hooks.server.ts             # Auth hooks (authentication + authorization) — every request
├── service-worker.ts           # PWA: asset caching + push notification handling
├── lib/
│   ├── components/             # Reusable Svelte components
│   ├── server/                 # Server-only helpers: itemFilters, notifications, registration,
│   │                           #   lendingTerms, pushSubscriptions, travelTimes, groups (owned/member + counts)
│   ├── types/models.ts         # TS interfaces for all PocketBase collections + public views
│   ├── utils/                  # utils.ts (formatTimestamp, displayName, itemImageUrl),
│   │                           #   imageUtils (compressImage), categoryPlaceholder, pushSubscription (client)
│   └── texts.ts                # ALL German UI strings + ITEM_CATEGORIES
└── routes/
    ├── api/
    │   ├── geocode/            # GET  — ORS address autocomplete (Germany only)
    │   ├── travel-times/       # POST — ORS travel time matrix
    │   ├── push-subscribe/     # POST — register/unregister push subscriptions
    │   ├── analyze-item/       # POST — Mistral image → name/description/categories (prod only)
    │   ├── diagnostics/        # POST — fire-and-forget client diagnostics logging
    │   └── redirect/           # GET  — safe outbound redirect (https only) + click logging
    ├── auth/                   # login, register, reset, logout
    ├── onboarding/             # multi-step first-run onboarding flow
    ├── invite/[slug]/          # invite-link landing (sets invitedBy on register)
    ├── conversations/[conversationId]/  # messaging + lending lifecycle
    ├── items/[id]/             # item detail view
    ├── notifications/          # in-app notification list
    ├── search/                 # browse/search items (logs queries to `searches`)
    ├── social/                 # trust network management
    ├── groups/                 # group join pages: join/[token] (invite), [id] (public self-join)
    ├── user/                   # current user's profile, items, bulk import, groups (user/groups)
    ├── users/[id]/             # other users' public profiles
    ├── misc/                   # static/legal pages (about, contact, guide, imprint, newsletter, privacy, tos)
    └── sitemap.xml/            # generated sitemap
docs/                           # Architecture docs — read before structural changes (see below)
```

## Architecture patterns

### Routing and data flow

SvelteKit file-based routing. Each route uses:
- `+page.svelte` — UI component
- `+page.server.ts` — `load()` for data fetching, `actions` for form submissions
- `+layout.server.ts` — provides `currentUser` to all pages
- `+server.ts` — explicit HTTP endpoints (the `/api/*` routes above)

All mutations go through **form actions** (`action="?/actionName"`). There is no REST API layer for app data; the `/api/*` endpoints exist only for external integrations and client-side helpers.

Use the Svelte 5 runes API throughout: `$state()`, `$derived()`, `$props()`, `$effect()`, `$bindable()`.

### CRITICAL: do not destructure the `data` prop

Breaking `use:enhance` reactivity is the #1 footgun. Always access page data directly:

```svelte
<!-- CORRECT -->
{#each data.trustees as trustee}

<!-- WRONG — breaks use:enhance reactivity -->
<script lang="ts">
  const { data } = $props();
  let trustees = data.trustees; // detaches reactivity
</script>
```

### CRITICAL: always build PocketBase filters with `pb.filter()`

Never interpolate values directly into a filter string with template literals
(`` `owner = "${id}"` ``) — a value containing `"` can break out of the filter
expression and change which records match (filter injection). Always use the
SDK's `pb.filter(raw, params)` helper, which escapes each placeholder:

```typescript
// CORRECT
pb.filter('inviteCode = {:code}', { code: inviteCode })
// WRONG — filter injection if `code` contains a `"`
`inviteCode = "${code}"`
```

This applies to **every** interpolated value — including IDs from `locals.user.id`
or route params, not just obviously "user-supplied" fields. Use `locals.pb.filter(...)`
in routes and `pb.filter(...)` in `$lib/server/*` helpers that take `pb: PocketBase`.

### PocketBase access pattern

`locals.pb` is the PocketBase client (server-side only). `locals.user` is the
authenticated user record (null if unauthenticated). Schema changes are made in
the PocketBase admin dashboard — there are no migration files in this repo.

```typescript
// +page.server.ts
export async function load({ locals }) {
  const items = await locals.pb.collection('items').getFullList({
    filter: locals.pb.filter('owner != {:userId}', { userId: locals.user.id }),
    expand: 'owner',
    sort: '-updated'
  });
  return { items };
}
```

### Trust-based item visibility

`filterTrustedItems()` in `$lib/server/itemFilters` hides items with `trusteesOnly=true`
from users not in the owner's `trusts[]` list. Always call it after fetching items in
server load functions. Unauthenticated browsing reads the **public views** (`items_public`,
`users_public`) rather than the base collections — these deliberately omit sensitive
fields (email, raw coordinates). Be careful not to leak trusted items or trust-graph data
through them.

### Item images

Item images are PocketBase file fields. Pass `PUBLIC_PB_URL` from the server and build the
URL client-side: `pb.getFileUrl(item, item.image)` or
`` `${PB_IMG_URL}/api/files/items/${item.id}/${item.image}` ``. Compress uploads client-side
with `compressImage()` from `$lib/utils/imageUtils`. Items may instead carry an
`externalImgUrl` (institution catalogue cover) shown when no file is uploaded.

### Real-time subscriptions

Use `subscribeRealtime()` from `$lib/client-pb` for client-side PocketBase realtime
(e.g. live chat). It returns an unsubscribe function suitable for `$effect`/`onMount`
cleanup. Do **not** call `pb.collection(x).subscribe()` directly — the resilient layer adds
retry on connect failure (the SDK gives up permanently on a first-attempt
"Invalid realtime client" 400) and re-establishes subscriptions after a network drop or a
mobile tab background-freeze (which silently kills the SSE stream without an error event).
Pass an optional `onReconnect` callback to refetch state that may have changed while the
stream was down — live events are not replayed (issue #435).

## Data model

PocketBase collections (see [docs/data-model.md](../docs/data-model.md) and
[docs/domain-model.md](../docs/domain-model.md) for full schemas, the `*_public` view
SQL, and ER/class diagrams):

| Collection | Purpose / key fields |
|---|---|
| `users` | `username`, `email`, `city`, `trusts[]`, `preferredTransportMode`, `inviteCode`, `invitedBy`, `hasOnboarded`, `verified`, `isInstitution`, `profileImage`, `bio`, `deleted` / `deletedAt` (account-deletion flag — see below). (Geolocation + messenger contacts were moved off `users` into the owner-only collections below.) |
| `user_geolocations` | owner-only: `user` (FK), coordinates (GeoPoint). Raw coordinates never exposed via public views. |
| `user_contacts` | owner-only: `user` (FK), telegram/signal handles (+ `*VisibleToTrustedOnly` flags) |
| `items` | `name`, `description`, `image` (file), `place`, `owner` (FK), `trusteesOnly`, `groups[]` (FK, shared-with groups), `status`, `categories[]`; institution-only `externalId` / `externalUrl` / `externalImgUrl` |
| `groups` | `name`, `description`, `owner` (FK), `isPublic` (public ⇒ world-readable + self-join). See [docs/groups.md](../docs/groups.md) |
| `group_members` | join table: `group` (FK), `user` (FK), `role` (`admin`\|`member`; owner stored as `admin`); unique `(group,user)` |
| `group_invites` | `group` (FK), `token`, `expiresAt?`, `maxUses` (0=∞), `uses`, `createdBy`; resolved via elevated `/api/group-invite/{token}` hooks |
| `conversations` | `requester`, `itemOwner`, `requestedItem`, `messages[]`, `readByRequester`, `readByOwner`, `lendingStatus`, `counterfactual` |
| `messages` | `messageContent`, `from` (FK), `to` (FK) |
| `notifications` | `recipient`, `sender`, `type`, `relatedId`, `body` (German text), `read` |
| `lending_terms` | versioned institutional terms of use: `owner`, `version`, `title`, `body`, `effectiveFrom`, `active`, `minAge` |
| `term_acceptances` | acceptance audit trail: `user`, `terms` (FK), `acceptedAt`, `confirmedAdult`, plus snapshots of the terms text/version |
| `push_subscriptions` | `user` (FK), `endpoint`, `p256dh`, `auth` |
| `deleted_accounts` | restricted audit store written on account deletion: `user` (FK), `email`, `username`, `deletedAt` — **superuser-only access rules**, holds retained identifiers for the dispute-resolution window |
| `outbound_clicks` | analytics for `/api/redirect`: `destination`, `source_page`, `item` |
| `searches` | search-query analytics: `query`, `categories` |
| `feedback` | `feedbackMessage`, `route`, `device`, `viewportSize`, `browser`, `browserVersion` |
| `items_public` / `users_public` | read-only views for unauthenticated browsing (no email, no raw coordinates) |

`NotificationType`: `new_message`, `new_request`, `trust_added`, `invite_accepted`,
`request_accepted`, `request_rejected`, `handover_confirmed`, `return_requested`,
`return_confirmed`.

## Auth and authorization

`src/hooks.server.ts` runs `sequence(authentication, authorization)` on every request:

- **Authentication** — loads PocketBase auth from cookies, refreshes the token, sets `locals.user`
- **Authorization** — redirects unauthenticated users to `/auth/login` (preserving `redirectTo`)

Unprotected path prefixes (`unprotectedPrefix` in `hooks.server.ts`): `/auth/login`,
`/auth/register`, `/auth/reset`, `/search`, `/items`, `/users`, `/misc`, `/invite`,
`/sitemap.xml`, `/api/redirect`, `/api/diagnostics`, `/auth/account-deleted`. Everything else —
including `/` (home) — requires authentication.

## Account deletion & GDPR

Self-service account deletion (Art. 17) and data export (Art. 15/20) live at `/user/account`
(linked from the profile page). The heavy lifting runs in the **backend PocketBase hooks**
(`allerleih-backend/pb_hooks/account.pb.js` + `services/account.js`), which have superuser
`$app` access — required to edit other users' records during anonymization:

- `DELETE /api/account` (body `{ password }`) — re-auth, refuses if a loan is still open
  (`accepted`/`active`/`return_requested`), then in a transaction: copies `email`+`username`
  into the restricted `deleted_accounts` collection, hard-deletes personal-only data
  (contacts, geolocation, push subs, own notifications, and items nobody requested — items
  referenced by a conversation are kept as `unavailable` since `requestedItem` is required),
  removes the user from every other user's `trusts[]`, and anonymizes the live `users` row in
  place (placeholder
  `username`/`email`, `deleted=true`, random password). Shared/audit data (messages,
  conversations, `term_acceptances`) is **retained** and resolves to "Gelöschtes Konto".
- `GET /api/account/export` — machine-readable JSON of all the caller's data; proxied to the
  browser as a download by `src/routes/user/account/export/+server.ts`.
- `onRecordAuthRequest` (users) blocks login for `deleted=true` accounts; `hooks.server.ts`
  enforces the same defensively.

Deleted users' names are masked everywhere via `displayName()` in `$lib/utils/utils.ts` —
**never render `user.username` directly** for a user that might be deleted. A future "phase 2"
purge job (not yet built) uses `deletedAt` to finally remove the retained identifiers.

## Push notifications

Web Push (VAPID) via the `web-push` package. Server helpers in `$lib/server/notifications.ts`:
- `createNotification()` — writes a record to the `notifications` collection
- `sendPushToUser()` — pushes to all registered devices; auto-removes stale subscriptions (HTTP 410/404)

Subscription CRUD lives in `$lib/server/pushSubscriptions.ts` (server) and
`$lib/utils/pushSubscription.ts` (client). The service worker (`src/service-worker.ts`)
handles `push` and `notificationclick`; notifications are suppressed if the user already has
the target page open.

## External APIs

- **OpenRouteService (ORS)** — `ORS_API_KEY`. `GET /api/geocode` (address autocomplete,
  Germany only) and `POST /api/travel-times` (travel-time matrix; `foot`, `bicycle`, `car`).
  Server logic in `$lib/server/travelTimes.ts`.
- **Mistral** — `MISTRAL_API_KEY` (production only). `POST /api/analyze-item` runs item-photo
  recognition (`pixtral-12b-2409`) to pre-fill name/description/categories. Rate-limited per user.

## Testing

Test files live co-located with their target (e.g. `+page.server.test.ts` next to
`+page.server.ts`). Mock PocketBase by constructing a `mockLocals` object with
`pb.collection(name)` returning `vi.fn()` stubs. See
[docs/testing-strategy.md](../docs/testing-strategy.md) for a full example.

## Text management

All German UI strings live in `src/lib/texts.ts`, organized by feature (`auth`, `nav`,
`forms`, `errors`, `buttons`, etc.); `ITEM_CATEGORIES` (the fixed 9-category list) lives there
too. Always add new user-facing strings there rather than inline in components. See
[docs/text-management.md](../docs/text-management.md).

## Documentation

Docs live in `./docs` and are published to a static GitHub Pages site via a GitHub Action.
**Read the relevant doc before making structural changes**, and update it whenever you change
the data or domain model.

**Keep this CLAUDE.md in sync.** Whenever you add, remove, or rename a route, an `/api/*`
endpoint, a PocketBase collection/view, a server helper or util, or an environment variable,
update the corresponding section here in the same change so the file never drifts from the code.

- [docs/architecture.md](../docs/architecture.md) — system architecture, auth flow, tech stack
- [docs/best-practices.md](../docs/best-practices.md) — CRUD form patterns and conventions
- [docs/data-model.md](../docs/data-model.md) — collection schemas + public-view SQL
- [docs/domain-model.md](../docs/domain-model.md) — class diagrams and domain relationships
- [docs/groups.md](../docs/groups.md) — groups feature: roles, public/self-join, visibility model
- [docs/testing-strategy.md](../docs/testing-strategy.md) — testing approach + mock examples
- [docs/text-management.md](../docs/text-management.md) — UI string organization
- [docs/operations/](../docs/operations/) — operational runbooks (e.g. institutional onboarding)
