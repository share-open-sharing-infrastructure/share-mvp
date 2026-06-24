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
npm run dev          # dev server
npm run build        # production build (also type-checks; runs in CI)
npm run check        # svelte-kit sync + svelte-check (type checking)
npm run lint         # ESLint        (lint:fix to auto-fix)
npm run format       # Prettier
npm run test         # Vitest WATCH mode
npx vitest run                          # run all tests once (CI-style)
npx vitest run src/path/to/file.test.ts # run a single test file
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
- `locals.pb` = server PocketBase client; `locals.user` = auth record (null if unauthenticated).
  `src/hooks.server.ts` runs `sequence(authentication, authorization)`; `/` requires auth.

## Where to look (load on demand)

| Working on… | Read / run |
|---|---|
| System architecture, routes, auth flow, external APIs | `docs/architecture.md` |
| Collection schemas + `*_public` view SQL | `docs/data-model.md` |
| Domain relationships / lending lifecycle | `docs/domain-model.md` |
| Form / CRUD patterns & conventions | `docs/best-practices.md` |
| Writing tests + PocketBase mocks | `docs/testing-strategy.md` |
| UI strings / categories | `docs/text-management.md`, `src/lib/texts.ts` |
| Institutional onboarding & other runbooks | `docs/operations/` |

## Project tooling (this repo's `.claude/`)

- `/create-pr` — preflight (lint/check/test/build), draft, and open a PR to `main`.
- `/accessibility-review` — audit changed Svelte files against the project's a11y patterns.
- `sveltekit-pb-reviewer` agent — delegated AllerLeih-specific code/security review
  (pb.filter, trust visibility, public-view leakage, runes, texts.ts). Complements the
  built-in `/code-review` and `/security-review`.

## Keep in sync

Docs in `./docs` are published to GitHub Pages. When you add/remove/rename a route, an
`/api/*` endpoint, a PocketBase collection/view, a server helper or util, or an env var,
update the relevant doc **and** this file's guardrails/router in the same change so they
never drift from the code.
