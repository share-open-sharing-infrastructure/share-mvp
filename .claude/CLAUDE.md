# CLAUDE.md

Guidance for Claude Code when working in this repository. This file is loaded on **every**
session, so it stays lean: it carries the always-relevant guardrails and a router to the
detailed docs/skills that load on demand. Read the linked doc before structural changes.

## Project overview

**AllerLeih** is an item-sharing platform. Users list items to share or lend and browse/request others'. 
The platform's purpose is to provide free and open-source infrastructure for the sharing economy. 
It integrates peer-2-peer-lending as well as institutional lending (either directly on the platform for small institutions or via integrations).
**The UI is entirely in German.**

## Tech stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 (runes) |
| Language | TypeScript (strict) |
| CSS | Tailwind CSS v4 + Flowbite Svelte |
| Backend / DB | PocketBase (hosted SQLite; schema + migrations live in separate repo) |
| Build / test | Vite · Vitest |
| Lint / format | ESLint (flat config) + Prettier |

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

Required in `.env` (see `docs/architecture.md` for what each does): `PUBLIC_PB_URL`,
`PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ORS_API_KEY`,
`MISTRAL_API_KEY` (prod only).

## Guardrails (always apply)

These prevent the most common bugs/security issues here — follow them without being asked.

- **Never destructure the `data` prop.** Access `data.x` directly in markup; assigning
  `let x = data.x` detaches `use:enhance` reactivity. → `docs/best-practices.md`
- **Always build PocketBase filters with `pb.filter(raw, {params})`** — never template-literal
  interpolation. Applies to *every* value, including IDs from `locals.user.id` / route params
  (filter injection). Use `locals.pb.filter(...)` in routes, `pb.filter(...)` in `$lib/server/*`.
- **Use Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`, `$bindable`). No `export let`.
- **All mutations go through form actions** (`action="?/name"`). `/api/*` endpoints exist only
  for external integrations + client helpers — there is no REST layer for app data.
- **Trust visibility:** call `filterTrustedItems()` (`$lib/server/itemFilters`) after fetching
  items. Unauthenticated browsing uses the `*_public` views — never leak email, raw coordinates,
  trusted items, or trust-graph data through them.
- **All user-facing strings go in `src/lib/texts.ts`** (+ `ITEM_CATEGORIES`), never inline.
- **Never render `user.username` directly** for any user who might be deleted — use
  `displayName()` from `$lib/utils/utils.ts` instead.
- `locals.pb` = server PocketBase client; `locals.user` = auth record (null if unauthenticated).
  `src/hooks.server.ts` runs `sequence(authentication, authorization)`; `/` requires auth.
  Authentication loads PocketBase auth from cookies and refreshes the token. Authorization
  redirects unauthenticated users to `/auth/login` (preserving `redirectTo`). Unprotected
  prefixes: `/auth/login`, `/auth/register`, `/auth/reset`, `/search`, `/items`, `/users`,
  `/misc`, `/invite`, `/sitemap.xml`, `/api/redirect`, `/api/diagnostics`,
  `/auth/account-deleted`. Everything else — including `/` (home) — requires authentication.

## Where to look (load on demand)

| Working on… | Read / run |
|---|---|
| System architecture, routes, auth flow, external APIs | `docs/architecture.md` |
| Collection schemas + `*_public` view SQL | `docs/data-model.md` |
| The `/search` page: params, filter building, pagination, which view it reads | `docs/search-discovery.md` |
| Schema/view migrations (separate repo) | `allerleih-backend` README → "Writing migrations" |
| Domain relationships / lending lifecycle | `docs/domain-model.md` |
| Form / CRUD patterns & conventions | `docs/best-practices.md` |
| Writing tests + PocketBase mocks | `docs/testing-strategy.md` |
| UI strings / categories | `docs/text-management.md`, `src/lib/texts.ts` |
| Groups: roles, public/self-join, visibility model | `docs/groups.md` |
| Account deletion & GDPR (Art. 17/15/20) | See "Account deletion" section below; backend: `allerleih-backend/pb_hooks/account.pb.js` |
| Push notifications (VAPID helpers, subscription CRUD, service worker) | `docs/architecture.md` → "Real-time Architecture"; helpers in `$lib/server/notifications.ts`, `$lib/server/pushSubscriptions.ts` |
| Institutional onboarding & other runbooks | `docs/operations/` |

## Project tooling (this repo's `.claude/`)

Skills auto-trigger from their own `description`; this list is the human index of what exists —
run one explicitly with `/<name>`. Build / change work:

- `/new-route` — scaffold a route (`+page.server.ts`/`.svelte` + co-located test) with the
  pb.filter / trust-visibility / runes / form-action guardrails baked in.
- `/add-notification-type` — wire a new notification type end-to-end (union → texts → trigger site →
  in-app routing), keeping `relatedId` / push url / href consistent.
- `/schema-change` — coordinate a schema change across both repos: migration (delegates to the
  backend `new-migration`) → `models.ts` → `docs/data-model.md` → public-view leak check.
- `/write-tests` — author tests to the repo's conventions (Vitest with mocked PocketBase).
- `/seed-scenario` — add a deterministic local seed scenario (items get generated placeholder images).

Maintenance & review:

- `/refresh-skills` — audit & fix the `.claude/skills` when code they cite drifts (paths, signatures,
  texts keys, commands). Run after a change that touches code a skill references.
- `/create-pr` — preflight (lint/check/test/build), draft, and open a PR to `main`.
- `/accessibility-review` — audit changed Svelte files against the project's a11y patterns.
- `sveltekit-pb-reviewer` agent — delegated AllerLeih-specific code/security review (pb.filter,
  trust/group visibility, public-view & `items_searchable` leakage, deleted-account masking, runes,
  texts.ts). Complements the built-in `/code-review` and `/security-review`.

## Keep in sync

Docs in `./docs` are published to GitHub Pages. When you add/remove/rename a route, an
`/api/*` endpoint, a PocketBase collection/view, a server helper or util, or an env var,
update the relevant doc **and** this file's guardrails/router in the same change so they
never drift from the code.

## Account deletion & GDPR

Self-service deletion (Art. 17) and export (Art. 15/20) live at `/user/account`. The heavy
lifting runs in the backend PocketBase hooks (`allerleih-backend/pb_hooks/account.pb.js` +
`services/account.js`), which have superuser `$app` access. Key behaviors:

- Refuses deletion if a loan is open (`accepted`/`active`/`return_requested`).
- Anonymizes the `users` row in place (`deleted=true`, placeholder username/email, random
  password); hard-deletes contacts, geolocation, push subs, and unreferenced items.
- Shared/audit data (messages, conversations, `term_acceptances`) is **retained** and resolves
  to "Gelöschtes Konto" via `displayName()`.
- `GET /api/account/export` returns machine-readable JSON; proxied as a download by
  `src/routes/user/account/export/+server.ts`.
