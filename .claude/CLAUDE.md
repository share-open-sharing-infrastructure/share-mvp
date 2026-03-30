# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**AllerLeih** is an item-sharing platform. Users list items they are willing to share or lend, and browse and request items from others. The trust system lets owners restrict certain items to trusted users only. The UI is entirely in German.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | SvelteKit 2 + Svelte 5 |
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
npm run check      # svelte-check + tsc type checking
npm run lint       # ESLint
npm run lint:fix   # ESLint with auto-fix
npm run format     # Prettier
npm run test       # Vitest (all tests)
npx vitest run src/path/to/file.test.ts  # run a single test file
```

## Environment variables

Required in `.env`:

```
PUBLIC_PB_URL=           # PocketBase instance URL
PUBLIC_VAPID_PUBLIC_KEY= # VAPID public key for push notifications
VAPID_PRIVATE_KEY=       # VAPID private key
VAPID_SUBJECT=           # VAPID subject (mailto: or https: URI)
ORS_API_KEY=             # OpenRouteService API key (geocoding + travel times)
```

## Project structure

```
src/
├── app.d.ts                    # Global TypeScript types (locals, PageData)
├── hooks.server.ts             # Auth hooks — runs on every request
├── service-worker.ts           # PWA: asset caching + push notification handling
├── lib/
│   ├── components/             # Reusable Svelte components
│   ├── server/                 # Server-only helpers (itemFilters, notifications)
│   ├── types/models.ts         # TypeScript interfaces for all PocketBase collections
│   ├── utils/utils.ts          # formatTimestamp(), setupPocketBaseSubscription()
│   └── texts.ts                # ALL German UI strings
└── routes/
    ├── api/geocode/            # GET — ORS address autocomplete
    ├── api/travel-times/       # POST — ORS travel time matrix
    ├── api/push-subscribe/     # POST — register/unregister push subscriptions
    ├── auth/                   # login, register, reset, logout
    ├── conversations/[conversationId]/  # messaging between users
    ├── items/[id]/             # item detail view
    ├── notifications/          # in-app notification list
    ├── search/                 # browse/search items
    ├── social/                 # trust network management
    ├── user/                   # current user's profile and items
    ├── users/[id]/             # other users' public profiles
    └── misc/                   # static pages (about, contact, imprint)
docs/                           # Architecture docs — read before making structural changes
```

## Architecture patterns

### Routing and data flow

SvelteKit file-based routing. Each route uses:
- `+page.svelte` — UI component
- `+page.server.ts` — `load()` for data fetching, `actions` for form submissions
- `+layout.server.ts` — provides `currentUser` to all pages
- `+server.ts` — explicit HTTP endpoints

All mutations go through **form actions** (`action="?/actionName"`). There is no REST API layer.

### Svelte 5 runes

Use the new runes API throughout: `$state()`, `$derived()`, `$props()`, `$effect()`, `$bindable()`.

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

### PocketBase access pattern

`locals.pb` is the PocketBase client (server-side only). `locals.user` is the authenticated user record (null if unauthenticated).

```typescript
// +page.server.ts
export async function load({ locals }) {
  const items = await locals.pb.collection('items').getFullList({
    filter: `owner != "${locals.user.id}"`,
    expand: 'owner',
    sort: '-updated'
  });
  return { items };
}
```

Schema changes are made in the PocketBase admin dashboard — no migration files in this repo.

### Item image URLs

Item images are PocketBase file fields. To display them, pass `PUBLIC_PB_URL` from the server and construct the URL client-side using the PocketBase SDK:

```typescript
// server: return { PB_IMG_URL: PUBLIC_PB_URL }
// client: pb.getFileUrl(item, item.image)
// or directly: `${PB_IMG_URL}/api/files/items/${item.id}/${item.image}`
```

### Real-time subscriptions

Use `setupPocketBaseSubscription()` from `$lib/utils/utils` for client-side PocketBase realtime (e.g. live chat). It returns an unsubscribe function suitable for use in `$effect` cleanup.

### Trust-based item visibility

`filterTrustedItems()` in `$lib/server/itemFilters` filters items where `trusteesOnly=true` to only show them to users in the owner's `trusts[]` list. Always call this after fetching items in server load functions.

## Data model

PocketBase collections:

| Collection | Key fields |
|---|---|
| `users` | `username`, `email`, `city`, `trusts[]` (user IDs), `telegramUsername`, `signalLink`, `geolocation` (GeoPoint), `preferredTransportMode` |
| `items` | `name`, `description`, `image` (file), `place`, `owner` (FK user), `trusteesOnly` (bool) |
| `conversations` | `requester` (FK user), `itemOwner` (FK user), `requestedItem` (FK item), `messages[]`, `readByRequester`, `readByOwner` |
| `messages` | `messageContent`, `from` (FK user), `to` (FK user) |
| `notifications` | `recipient` (FK user), `type` (`new_message`\|`new_request`\|`trust_added`), `relatedId`, `body` (German text), `read` (bool) |
| `push_subscriptions` | `user` (FK user), `endpoint`, `p256dh`, `auth` |
| `feedback` | `feedbackMessage`, `route`, `device`, `viewportSize`, `browser`, `browserVersion` |

See [docs/data-model.md](docs/data-model.md) for ER diagrams.

## Auth and authorization

`src/hooks.server.ts` runs `sequence(authentication, authorization)` on every request:

- **Authentication** — loads PocketBase auth from cookies, refreshes token, sets `locals.user`
- **Authorization** — redirects unauthenticated users to `/auth/login`

Unprotected routes: `/auth/login`, `/auth/register`, `/auth/reset`, `/search`, `/items`, `/users`, `/` (home)

## Push notifications

Uses Web Push (VAPID) via the `web-push` npm package. Two server helpers in `$lib/server/notifications.ts`:
- `createNotification()` — writes a record to the `notifications` collection
- `sendPushToUser()` — sends a push to all registered devices; auto-removes stale subscriptions (HTTP 410/404)

The service worker (`src/service-worker.ts`) handles `push` and `notificationclick` events. Notifications are suppressed if the user already has the target page open.

## External APIs

**OpenRouteService (ORS)** — requires `ORS_API_KEY`:
- `GET /api/geocode` — address autocomplete (restricted to Germany)
- `POST /api/travel-times` — travel time matrix between user location and item owners; supports `foot`, `bicycle`, `car` transport modes

## Testing

Test files live co-located with their target (e.g. `+page.server.test.ts` next to `+page.server.ts`). Mock PocketBase by constructing a `mockLocals` object with `pb.collection(name)` returning vi.fn() stubs. See [docs/testing-strategy.md](docs/testing-strategy.md) for a full example.

## Text management

All German UI strings live in `src/lib/texts.ts`, organized by feature (`auth`, `nav`, `forms`, `errors`, `buttons`, etc.). Always add new user-facing strings there rather than inline in components.

## Documentation

Docs live in ./docs and are published on a static GitHub page via a GitHub Action. If Claude makes any changes to the data- or domain-model, it should update them there.
