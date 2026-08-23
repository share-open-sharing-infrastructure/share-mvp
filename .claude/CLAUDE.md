# CLAUDE.md

Guidance for Claude Code when working in this repository. This file is loaded on **every**
session, so it stays lean: it carries the always-relevant guardrails and a router to the
detailed docs/skills that load on demand. Read the linked doc before structural changes.

## Project overview

**AllerLeih** is an item-sharing platform. Users list items to share or lend and browse/request
others'. It integrates peer-2-peer lending as well as institutional lending (directly on the
platform for small institutions, or via integrations — see `docs/integrations.md` and `README.md`
for the mission/milestones). **The UI is entirely in German.**

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

# Bring up the whole local stack (real-schema PocketBase + dev server + optional seed) in one
# command, with all env gotchas baked in. Backend lives in a sibling ../allerleih-backend.
scripts/dev-stack.sh --seed e2e

# Playwright end-to-end tests (browser-level; require a running PocketBase + superuser creds).
# Playwright starts the dev server itself; global-setup seeds the deterministic `e2e` scenario.
# See e2e/README.md for env + conventions.
PB_URL=http://127.0.0.1:8091 PB_SUPERUSER_EMAIL=you@example.com PB_SUPERUSER_PASSWORD=secret npm run test:e2e

# Seed a running PocketBase with deterministic test data. Scenarios live in
# scripts/seed/scenarios/ (one file per feature); shared helpers in scripts/seed/lib.js.
# Idempotent; only touches its own `@seed.test` records. Requires superuser creds.
npm run seed                                   # lists available scenarios
PB_SUPERUSER_EMAIL=you@example.com PB_SUPERUSER_PASSWORD=secret npm run seed -- account-deletion
```

## Environment variables

**All app env is read at runtime via `$env/dynamic/*`** (issue #627) — `$env/static/*` is banned
repo-wide (ESLint), so one build artefact serves any instance and nothing is baked in. The
**required** set lives in `$lib/server/env.ts` (`REQUIRED_PUBLIC_ENV` + `REQUIRED_PRIVATE_ENV`)
and is validated by the `init` hook in `src/hooks.server.ts`: a missing **or empty** value makes
the server refuse to start, naming every offender. Required (template: `.env.example`; see
`docs/architecture.md` for what each does): `PUBLIC_PB_URL`, `PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `ORS_API_KEY`, `PB_SUPERUSER_EMAIL`,
`PB_SUPERUSER_PASSWORD`. `MISTRAL_API_KEY` is the **only optional** var (unset ⇒
`/api/analyze-item` answers 503). `SYNC_SECRET` is **gone** as of #487 Phase 3 — the integrations
run entirely in the backend, so the frontend holds no sync secret and no `/api/sync`/`/api/refresh`
endpoints.
The two public plumbing vars are read only through `$lib/publicEnv.ts` (`pbUrl()` /
`vapidPublicKey()`) — functions, never module-scope constants, so nothing is snapshotted at import
time. The superuser credentials are read at runtime by `$lib/server/superuser.ts`
(`getSuperuserClient`), which backs `isAdmin()` + the `metrics_daily` reads in
`$lib/server/metrics.ts` — that makes them a **per-request app dependency**, not just tooling;
local tooling (seed scripts, Playwright e2e) reads the same two vars via `process.env`.
Instance configuration (multi-city, share-mvp#629/#646 — see `docs/architecture.md` → "Instance
configuration"): read via `$lib/instance.ts`, flagship-only defaults in
`$lib/instanceDefaults.ts`. Optional everywhere on the **flagship** instance (allerleih.org —
`PUBLIC_SITE_ORIGIN` unset or `https://allerleih.org`); on any OTHER `PUBLIC_SITE_ORIGIN`, seven
Class-A vars become **required or the server refuses to start**: `PUBLIC_INSTANCE_CITY`,
`PUBLIC_CONTACT_EMAIL`, `PUBLIC_IMPRINT_OPERATOR`, `PUBLIC_IMPRINT_STREET`,
`PUBLIC_IMPRINT_POSTAL_CODE`, `PUBLIC_IMPRINT_CITY`, `PUBLIC_IMPRINT_COUNTRY`. The rest
(`PUBLIC_IMPRINT_REPRESENTATIVE`, `PUBLIC_IMPRINT_REGISTER_ENTRY`, `PUBLIC_FEEDBACK_EMAIL`,
`PUBLIC_SOCIAL_TELEGRAM`/`MASTODON`/`PIXELFED`/`INSTAGRAM`, `PUBLIC_CONTRIBUTE_URL`,
`PUBLIC_GITHUB_URL`, `PUBLIC_APP_NAME`, `PUBLIC_ANALYTICS_ORIGIN`/`WEBSITE_ID`) stay optional
everywhere; empty ⇒ the corresponding link/field is hidden (`{#if}`), never a dead link.
`$env/dynamic/public` serialises the **whole** `PUBLIC_*` env into every rendered page, not just
the vars a module references — treat any `PUBLIC_*` var as fully public the moment it's set,
whether or not any module reads it (see `docs/architecture.md` → "Instance configuration").
Two adapter-node runtime knobs — `BODY_SIZE_LIMIT` (the official Docker image defaults this to
10 MB, matching the Uberspace deploy) and `ORIGIN` (required behind any reverse proxy, or form
actions fail their origin check) — are deliberately **not** in `REQUIRED_*`: `assertRequiredEnv()`
validates only app-level vars and has no way to see adapter-node's own env surface.
For personal local overrides (local ports, sandbox creds) that shouldn't be shared with the team,
use a gitignored `CLAUDE.local.md` at the repo root — it loads alongside this file.

## Guardrails (always apply)

These prevent the most common bugs/security issues here — follow them without being asked.

- **Never destructure the `data` prop.** Access `data.x` directly in markup; assigning
  `let x = data.x` detaches `use:enhance` reactivity — and a *user-editable* field seeded from
  `data.x`/a prop needs a seed-once `$state` + `bind:value`, never one-way `value=`, or hydration
  clobbers it (issue #558). A field that must keep *following* an external value (a URL-synced
  filter box) needs the absorbing-derived variant of the same rule instead of seed-once —
  issue #619. → `docs/best-practices.md`
- **Never `$env/static/*`** — env is read at **runtime** so one build artefact serves any
  instance (issue #627); a static import bakes an instance's value into the bundle. ESLint bans
  both static modules. Public vars go through `$lib/publicEnv.ts` (`pbUrl()`/`vapidPublicKey()`)
  or `$lib/instance.ts`; private vars `import { env } from '$env/dynamic/private'` at module scope
  as usual — what must never happen is **reading** `env.X` at module scope, i.e. into a
  module-level `const` or by passing it to something at import time (as the old
  `webpush.setVapidDetails` call did). `vite build` imports every server module with an empty env,
  so an import-time read sees `undefined`; read inside the function that needs the value. New
  required vars go into `$lib/server/env.ts`, which the `init` hook validates at startup.
- **Always build PocketBase filters with `pb.filter(raw, {params})`** — never template-literal
  interpolation. Applies to *every* value, including IDs from `locals.user.id` / route params
  (filter injection). Use `locals.pb.filter(...)` in routes, `pb.filter(...)` in `$lib/server/*`.
- **Use Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`, `$bindable`). No `export let`.
- **All mutations go through form actions** (`action="?/name"`). `/api/*` endpoints exist only
  for external integrations + client helpers — there is no REST layer for app data.
- **Trust visibility is enforced at the data layer**, not in app code: the `items` /
  `items_searchable` rules only return a trustees-only item to the owner's trustees (via the
  `trusts` join back-relation `owner.trusts_via_truster.trustee.id ?= @request.auth.id`). Read
  trust through `$lib/server/trust.ts` (`isTrusting` / `getTrustDirections` / `getTrustees` /
  `getTrusters`; `addTrust` / `removeTrust` for mutations); never re-implement trust filtering
  client-side. Unauthenticated
  browsing uses the `*_public` views — never leak email, raw coordinates, trusted items, or
  trust-graph data through them.
- **Lending status values & groupings come only from `$lib/lending.ts`** (`LendingStatus`,
  `LENDING_LIFECYCLE`, `ACTIVE_LENDING_STATES`, `OPEN_LENDING_STATES`, `ABORTABLE_LENDING_STATES`,
  `lendingStatusFilter`, `isLendingStatusIn`) — never re-list status literals inline or in filter
  strings. The backend
  keeps a deliberate mirror in `allerleih-backend/pb_hooks/services/account.js`
  (`BLOCKING_LOAN_FILTER` = `ACTIVE_LENDING_STATES`); adding/changing a status means updating
  `$lib/lending.ts` + `texts.lending.statusLabel` **and** that backend mirror in the same effort.
- **All user-facing strings go in `src/lib/texts.ts`**, never inline. Item categories live
  in `src/lib/categories.ts` (fixed across instances; change via `docs/data-model.md` → "Item categories").
- **Instance-specific values (city, origin, contact/feedback email, imprint, social links,
  analytics) come only from `$lib/instance.ts`** — never hardcode `allerleih.org`, a city name,
  or an operator's postal address. Flagship-only literal defaults live in
  `$lib/instanceDefaults.ts`, never inline in `instance.ts` or a route. A value that can be
  empty on a non-flagship instance (Class B — `$lib/instance.ts`'s header explains the
  A/B/C classes) needs an `{#if}` at its render site, since e.g. `buildRedirectHref('')` renders
  a dead link instead of nothing.
  Crawler-facing absolute URLs (sitemap, robots, canonical, `og:url`/`og:image`) use
  `instanceUrl()` with a **literal root-absolute path** (or `SeoHead`'s opt-in `canonical` flag,
  which derives the current page's own URL from `page.url.pathname`); user-facing share/invite
  links keep `url.origin` instead (a copied link must work on the host the user is actually on).
  **Never compose `instanceUrl(resolve(...))`** — `svelte.config.js` has no `paths` block, so
  SvelteKit's default `paths.relative: true` applies and `resolve()` returns a *page-relative*
  path under SSR, producing a malformed absolute URL that only looks right after client
  hydration recomputes it (issue #473). `texts.ts` interpolates the config into German copy and
  stays the single home for strings.
- **Never hand-style a button or import Flowbite `Button`** — use
  `$lib/components/ui/Button.svelte` (variants `primary|secondary|ghost|accent|danger|link`,
  sizes `sm|md|lg|xl|icon|icon-sm`, `loading`, `href`). Pass only layout classes (width/margin/
  position) via `class`, never colors. → `docs/design-system.md`
- **Never render `user.username` directly** for any user who might be deleted — use
  `displayName()` from `$lib/utils/utils.ts` instead.
- **Place components by usage scope, not habit.** Single-use → co-locate flat in the route folder
  (e.g. `src/routes/items/[id]/LinkifiedText.svelte`). A cluster of components local to one route
  (or route subtree) → a `components/` subfolder under it (e.g. `src/routes/components/`,
  `src/routes/auth/components/`). Used across unrelated route subtrees → `src/lib/components`
  (design-system primitives in `ui/`). → `/new-route` scaffolds new routes with this baked in.
- **Resolve internal navigation with `resolve()` from `$app/paths` at the call site**, in route-ID
  form (`resolve('/users/[id]', { id })`) — never template-string interpolation, never a wrapper.
  Query/hash go inside the `resolve()` arg; static `static/` files use `asset()`. Only builders
  (`buildSearchUrl`/`notificationHref`, plus the `/api/redirect`-proxy builders `buildRedirectHref`/
  `buildItemRedirectHref`) and external/user URLs are exempt — these builders construct URLs for
  purposes `resolve()` doesn't cover (search params, notification targets, the redirect-proxy for
  external links). → `docs/best-practices.md`
- `locals.pb` = server PocketBase client; `locals.user` = auth record (null if unauthenticated).
  `src/hooks.server.ts` runs `sequence(authentication, authorization, instanceHead)`.
  Authentication loads PocketBase auth from cookies and refreshes the token. Authorization
  redirects unauthenticated users to `/auth/login` (preserving `redirectTo`). Unprotected
  prefixes: `/auth/login`, `/auth/register`, `/auth/reset`, `/auth/confirm-verification`,
  `/auth/confirm-email-change`, `/search`, `/items`, `/users`,
  `/misc`, `/invite`, `/sitemap.xml`, `/robots.txt`, `/api/redirect`, `/api/diagnostics`,
  `/auth/account-deleted`. **`/` (home) is public too** — it is exempted explicitly
  (`&& pathname !== '/'` in `authorization`) and its load returns only `getPublicStats()`, so
  **never assume `locals.user` is set on `/`**. Everything else requires authentication.
  On top of that, `authorization` runs the legal-consent gate (#399) for every *logged-in*
  request outside `legalGateExempt` (`/legal`, `/auth`, `/misc`, `/api/diagnostics`,
  `/api/redirect`): a declined user is sent to `/legal/locked`, one with outstanding
  ToS/privacy versions to `/legal/accept`.

## Where to look (load on demand)

| Working on… | Read / run |
|---|---|
| System architecture, routes, auth flow, external APIs | `docs/architecture.md` |
| Collection schemas + `*_public` view SQL | `docs/data-model.md` |
| The `/search` page: params, filter building, pagination, which view it reads | `docs/search-discovery.md` |
| Schema/view migrations (separate repo) | `allerleih-backend` README → "Writing migrations" |
| Domain relationships / lending lifecycle | `docs/domain-model.md` |
| Form / CRUD patterns & conventions | `docs/best-practices.md` |
| Buttons, theme tokens, white-labeling (`[data-theme]`) | `docs/design-system.md` |
| Writing tests + PocketBase mocks | `docs/testing-strategy.md` |
| UI strings / categories | `docs/text-management.md`, `src/lib/texts.ts` |
| Groups: roles, public/self-join, visibility model | `docs/groups.md` |
| Partner catalogue integrations (leihbackend, WINBIAP); CSV import writes via `/api/import/*`; adding a new integration | `docs/integrations.md`; leihbackend API reference: `docs/leihbackend-integration-spec.md` |
| Operating the integration sync/refresh cron + CSV import (all backend-run; discovery via `sync_config`) | `docs/operations/integration-sync.md` |
| Account deletion & GDPR (Art. 17/15/20) | See "Account deletion" section below; backend: `allerleih-backend/pb_hooks/account.pb.js` |
| Push notifications (VAPID helpers, subscription CRUD, service worker) | `docs/architecture.md` → "Real-time Architecture"; helpers in `$lib/server/notifications.ts`, `$lib/server/pushSubscriptions.ts` |
| Business metrics (`/admin/metrics`, `/misc/stats`, the nightly `metrics_daily` snapshot) | `docs/operations/metrics.md`; helper in `$lib/server/metrics.ts` |
| Mail deliverability (SPF/DKIM/DMARC, digest one-click unsubscribe, `assetBase`/`siteBase` URL split, `digestEmails` opt-out) | `docs/operations/mail-deliverability.md`; backend hooks in `allerleih-backend/pb_hooks/services/{mail,unsubscribe}.js`, `utils/urls.js`; frontend: `$lib/server/userPreferences.ts`, `src/routes/user/profile/{NotificationSettings,PushNotificationSection,EmailNotificationForm}.svelte`, the `saveNotificationPrefs` action in `src/routes/user/profile/+page.server.ts` |
| Running a second (city) instance: origin/city/contact/analytics config, the origin rule, branding limits | `docs/architecture.md` → "Instance configuration (multi-city)"; config in `src/lib/instance.ts` |
| Institutional onboarding & other runbooks | `docs/operations/` |
| Docker image / self-hosting | `docs/architecture.md` → "Running the official container image" (frontend image alone); `Dockerfile`, `.github/workflows/docker-publish.yaml`; for the full `docker compose` stack (both images) + first-run runbook, `docs/operations/self-hosting.md` and `deploy/` (`compose.yaml`, `.env.docker.example`, `Caddyfile`) |
| A backend-only issue (no frontend changes) | Still drive it through `/issue-to-pr` + `/create-pr` **here** — the plan gate and review dispatch (`sveltekit-pb-reviewer` covers `pb_hooks`/`pb_migrations`) live in this repo. The backend also has its own `allerleih-backend/.claude/skills/create-pr` for standalone use when working in that repo alone. |

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
- `/drive-app` — bring up the local stack and drive the running app in a browser (whichever browser
  MCP the session has) to see a change work for real. Prefer `npm run test:e2e` when a spec can
  already answer the question — it's cheaper and repeatable.

Maintenance & review:

- `/refresh-skills` — audit & fix the `.claude/skills` when code they cite drifts (paths, signatures,
  texts keys, commands). Run after a change that touches code a skill references.
- `/create-pr` — preflight (lint/check/test/build), draft, and open a PR to `main`.
- `/accessibility-review` — audit changed Svelte files against the project's a11y patterns.
  These patterns are the repo truth; the `a11y-reviewer` agent reads this skill before judging.
- `/review-all` — run the reviewer roles below in parallel against the current diff, then
  consolidate, dedupe, and **fix** Blocking + Should-fix findings, ending with a change log
  (`file:line — [severity, role] what` + why). No commit/push/PR. Cost-aware (see below).

**Reviewer & implementation agents.** The review is split into **four narrow reviewer roles**
instead of one catch-all checklist — each gets its own context window, they run in parallel, and
findings don't duplicate. They share the contract in `.claude/review-contract.md` (scope,
severity, output format, revier boundaries) and are all **read-only**; fixing happens in the
orchestrating skill.

- `sveltekit-pb-reviewer` — security & data protection: pb.filter injection, trust/group
  visibility, public-view & `items_searchable` leakage, auth, PII/GDPR, realtime authorisation.
- `code-quality-reviewer` — file length, complexity, duplication, abstraction altitude,
  anti-patterns.
- `a11y-reviewer` — WCAG 2.1 AA, on top of the `/accessibility-review` patterns.
- `conventions-reviewer` — runes rules, `texts.ts`, `Button.svelte`, `displayName()`,
  `subscribeRealtime()`, test conventions (runs on Haiku — it's checklist/grep-driven).
- `allerleih-coder` — implementation agent used by `/review-all` (and the maintainer's local
  issue pipeline) to carry out multi-file fixes. Does **not** commit, push, or open PRs.
- `allerleih-tester` — change-scoped QA agent: runs the Vitest/backend/e2e tests the diff impacts
  and, when the tests can't answer the question, drives the changed flow in a real browser using
  whichever browser MCP the session has (Playwright or Chrome DevTools — the user's choice).
  Read-only on source **by contract, not by permission**: unlike the reviewer roles it runs with
  the full tool set, so the orchestrating skill checks the working tree afterwards and treats any
  modification as a failed run. Invoke it directly to verify a change, or via `/review-and-test`.

**Cost rules baked into `/review-all` — do not optimise them away:** (1) diff ≤ 40 lines over
≤ 3 files ⇒ the orchestrator reviews it itself, no agents; (2) each role only starts when the
diff touches its area (gates); (3) the orchestrator fetches the diff once and passes it in the
prompt — the contract forbids the agents from re-deriving scope and caps them at ~15 tool calls.
`/security-review` is a second lens only for genuinely security-critical diffs, not routine.

These complement the built-in `/code-review` and `/security-review`.

**MCP servers are optional and must be named to be used.** Nobody's setup is guaranteed to have
them, and Claude Code loads MCP tools on demand — so an agent that isn't told a server exists never
looks for it and quietly falls back to `grep`/`cat`. Whichever of these the session has:

| Server | Use it for |
|---|---|
| `svelte` | any Svelte 5 / SvelteKit API question; `svelte-autofixer` on components you write |
| Context7 | signatures of other external libraries (Flowbite, Tailwind, web-push, ORS) |
| **Serena** (`mcp__serena__*`) | navigating *this* codebase by symbol instead of by text |
| a browser MCP (Playwright **or** Chrome DevTools) | driving the running app; see `/drive-app` |

Serena is worth naming explicitly because the built-in tools always look sufficient: the case where
it is not a preference but a correctness difference is **"where else is this symbol used?"** —
`find_referencing_symbols` resolves that through the type checker, while `grep` misses aliased
re-imports (`import { displayName as dn }`) and pads the result with comments and substring hits. For
a security helper, a guardrail or a dead-code claim, that gap decides whether the answer is right.
Also useful: `get_symbols_overview` instead of reading a long file, `rename_symbol` /
`replace_symbol_body` / `safe_delete_symbol` for edits, `get_diagnostics_for_file` for type errors
without a full `npm run check`. Keep `Grep` for literal text and anything Serena doesn't index (YAML,
Markdown). The four reviewer roles are granted its **read-only** tools only — their enforced
read-only property depends on the mutating ones staying out of the grant.

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
