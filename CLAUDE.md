# CLAUDE.md — share-mvp (AllerLeih)

## Project overview

**AllerLeih** is a local item-sharing/lending platform. Users list items they are willing to lend, browse and request items from others, and manage a trust network that controls item visibility. The UI is entirely in German for now.

- Hosted PocketBase backend: `https://pocketbase.menkent.uber.space/`
- Current milestone: user testing MVP (Jan 2026); organizational integration targeted for mid-to-late 2026

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
npm run test       # Vitest
```

## Project structure

```
src/
├── app.d.ts                    # Global TypeScript types (locals, PageData)
├── hooks.server.ts             # Auth hooks — runs on every request
├── lib/
│   ├── components/             # Reusable Svelte components (NavBar, Footer, etc.)
│   ├── server/
│   │   └── itemFilters.ts      # Trust-based item visibility filtering
│   ├── types/
│   │   └── models.ts           # TypeScript interfaces for PocketBase collections / data model
│   ├── utils/
│   │   └── utils.ts            # formatTimestamp(), setupPocketBaseSubscription()
│   └── texts.ts                # ALL German UI strings — add new strings here
└── routes/
    ├── auth/                   # login, register, reset, logout
    ├── conversations/[id]/     # messaging between users
    ├── items/[id]/             # item detail view
    ├── search/                 # browse/search items
    ├── social/                 # trust network management
    ├── user/                   # current user's own profile and items
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
- `+server.ts` — explicit HTTP endpoints (only used for logout)

All mutations go through **form actions** (`action="?/actionName"`), not REST endpoints. There is no REST API layer.

### Svelte 5 runes

Use the new runes API throughout:
- `$state()` — reactive local state
- `$derived()` — computed values (replaces `$:`)
- `$props()` — component props
- `$effect()` — side effects
- `$bindable()` — two-way binding

### CRITICAL: do not destructure the `data` prop

Breaking `use:enhance` reactivity is the #1 footgun in this codebase. Always access page data directly from the `data` prop:

### PocketBase access pattern

PocketBase client is available server-side via `locals.pb`. The authenticated user record is at `locals.user`.

```typescript
// In +page.server.ts
export async function load({ locals }) {
  const items = await locals.pb.collection('items').getFullList({
    filter: 'owner = "userId"',
    expand: 'owner',
    sort: '-updated'
  });
  return { items };
}

export const actions = {
  createItem: async ({ locals, request }) => {
    const formData = await request.formData();
    try {
      await locals.pb.collection('items').create(formData);
    } catch (err) {
      return fail(400, { error: 'Could not create item' });
    }
  }
};
```

Schema changes are made in the PocketBase admin dashboard — there are no migration files in this repo.

## Data model

Five PocketBase collections:

| Collection | Key fields |
|---|---|
| `users` | `username`, `email`, `city`, `trusts[]` (user IDs), `telegramUsername`, `signalLink` |
| `items` | `name`, `description`, `image` (file), `place`, `owner` (FK user), `trusteesOnly` (bool) |
| `conversations` | `requester` (FK user), `itemOwner` (FK user), `requestedItem` (FK item), `messages[]`, `readByRequester`, `readByOwner` |
| `messages` | `messageContent`, `from` (FK user), `to` (FK user) |
| `feedback` | `feedbackMessage`, `route`, `device`, `viewportSize`, `browser`, `browserVersion` |

See [docs/data-model.md](docs/data-model.md) for ER diagrams.

## Auth and authorization

`src/hooks.server.ts` runs `sequence(authentication, authorization)` on every request:

- **Authentication** — loads PocketBase auth from cookies, refreshes token, sets `locals.user` (null if unauthenticated)
- **Authorization** — redirects unauthenticated users to `/auth/login` unless the route starts with an unprotected prefix

Unprotected routes: `/auth/login`, `/auth/register`, `/auth/reset`, `/search`, `/items`, `/users`, `/` (home)


## Text management

All German UI strings live in [src/lib/texts.ts](src/lib/texts.ts), organized by feature (`auth`, `nav`, `forms`, `errors`, `buttons`, etc.). Always add new user-facing strings there rather than inline in components. The file is structured for future i18n migration.


