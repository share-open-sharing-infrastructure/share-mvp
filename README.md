# AllerLeih — share-mvp (frontend)

AllerLeih is a platform for sharing! The app's purpose is to allow users to find everything that friends, family and strangers offer for borrowing in the area. The long-term goal is to integrate the platform with software like [leihbase](https://github.com/leihbase/leihbase), so that users can borrow both from private persons as well as from lending organisations like [Libraries of Things](https://en.wikipedia.org/wiki/Library_of_things) or for-profit lenders.

This repository holds the **SvelteKit frontend**. The PocketBase server it talks to lives in a separate repo, [allerleih-backend](https://github.com/share-open-sharing-infrastructure/allerleih-backend) — you need both checked out to develop locally.

Here, we develop a first minimum viable product. For a fine-grained timeline, see the attached [GitHub Project](https://github.com/orgs/share-open-sharing-infrastructure/projects/2).

If you wish to contribute or are otherwise interested in the project, please don't hesitate to get in touch via kontakt@allerleih.org.

> **The UI is presently in German.** All user-facing strings live in `src/lib/texts.ts`; code, comments, docs and PR descriptions are English. We will internationalise the platform asap.

---

## Tech stack

| Layer         | Technology                                             |
| ------------- | ------------------------------------------------------ |
| Framework     | SvelteKit 2 + Svelte 5 (runes)                         |
| Language      | TypeScript (strict)                                    |
| CSS           | Tailwind CSS v4 + Flowbite Svelte                      |
| Backend / DB  | PocketBase (SQLite; schema + hooks in a separate repo) |
| Build         | Vite                                                   |
| Tests         | Vitest (unit) · Playwright (end-to-end)                |
| Lint / format | ESLint (flat config) + Prettier                        |

---

## Getting started

### Prerequisites

| What              | Version / note                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**       | **24.19.0** (Active LTS) — the version CI pins (`.github/workflows/*.yaml`). Use `nvm install 24.19.0 && nvm use 24.19.0` so local and CI behave identically. |
| **npm**           | Ships with Node. Use `npm ci` (not `npm install`) so `package-lock.json` is respected.                                                                  |
| **git**           | Any recent version.                                                                                                                                     |
| **A POSIX shell** | `scripts/dev-stack.sh` and the backend's test harness are bash scripts. On **Windows, use WSL** (or Git Bash) — native PowerShell/cmd is not supported. |
| **The backend**   | A checkout of [allerleih-backend](https://github.com/share-open-sharing-infrastructure/allerleih-backend) plus its PocketBase binary. See step 1.       |

### 1. Clone both repos side by side

`scripts/dev-stack.sh` defaults to a sibling `../allerleih-backend`, so keep this layout (or set `PB_BACKEND_DIR` later):

```bash
git clone https://github.com/share-open-sharing-infrastructure/share-mvp.git
git clone https://github.com/share-open-sharing-infrastructure/allerleih-backend.git
```

Then follow the backend's README to download the PocketBase binary into `allerleih-backend/` — the frontend cannot run without a backend to talk to.

### 2. Install dependencies

```bash
cd share-mvp
npm ci
```

### 3. Create your `.env`

```bash
cp .env.example .env
```

**Copy `.env.example` and keep its placeholders — the file is filled in so a fresh clone boots.**
Every variable is read at **runtime** via SvelteKit's `$env/dynamic/*`, not baked into the build,
so one build artefact serves any instance. The flip side: the server **refuses to start** when a
required variable is missing **or empty** — it prints every offending name with what it is for and
exits non-zero (`assertRequiredEnv()` in `src/lib/server/env.ts`, called from the `init` hook). An
empty value is *not* "unset but fine". The old `Missing export "X"` build failure no longer exists.
`MISTRAL_API_KEY` is the only variable you may leave empty. The check is presence-only, though: it
guarantees a non-empty line exists, **not** that the value is valid — `ORS_API_KEY=replace-me-…`
satisfies it and still yields empty address suggestions.

| Variable                                                     | Needed for                                                               | How to get it                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_PB_URL`                                              | Everything — the PocketBase instance the app talks to                    | Your local backend, e.g. `http://127.0.0.1:8090/`. A trailing slash is added if you omit it — image URLs are built as `${pbUrl()}api/files/…`. |
| `PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`              | Web push notifications                                                   | Ask kontakt@allerleih.org for the shared dev pair, or generate a throwaway one with `npx web-push generate-vapid-keys`.                 |
| `VAPID_SUBJECT`                                              | Web push                                                                 | A `mailto:` URI, e.g. `mailto:you@example.com`.                                                                                         |
| `ORS_API_KEY`                                                | Address autocomplete (`/api/geocode`)                                    | Request from kontakt@allerleih.org. Travel times additionally need the **backend's** own `ORS_API_KEY`.                                 |
| `MISTRAL_API_KEY`                                            | AI item-photo analysis (`/api/analyze-item`)                              | Request from kontakt@allerleih.org. **The only optional variable** — unset ⇒ that endpoint answers 503 and nothing else changes.        |
| `PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`                | The app at runtime (the `/admin` gate via `isAdmin()`, the public stats on `/` and `/misc/stats`, `metrics_daily`) **and** the seed runner + Playwright e2e | A superuser you create on your own local backend (step 4). `scripts/dev-stack.sh` upserts the pair from `.env.example`. (`SYNC_SECRET` is gone — #487 Phase 3 moved the integrations into the backend.) |
| `DEV_ALLOWED_HOST`, `DEV_DISABLE_MKCERT`                     | Optional dev-server tweaks (see `vite.config.ts`)                        | Set `DEV_DISABLE_MKCERT=true` when mkcert can't install its CA (no sudo) or TLS is terminated upstream.                                 |

Credentials for the real external services are **not** in the repo. Ask kontakt@allerleih.org for shared development credentials; until you have them, keep the `.env.example` placeholders for the required variables — the dependent feature won't work, but the app starts and the rest runs fine. Do **not** blank a required variable out: an empty value stops the server from starting at all.

### 4. Start the stack

One command brings up the real-schema PocketBase **and** the dev server, with the env gotchas (trailing slash, mkcert, `127.0.0.1` binding) already handled:

```bash
scripts/dev-stack.sh --seed e2e
```

That starts PocketBase on `http://127.0.0.1:8091`, upserts the superuser `admin@local.test` / `localdev12345`, seeds the deterministic `e2e` scenario, and serves the app on `http://127.0.0.1:5173`. Ctrl-C stops both.

Useful flags and overrides:

```bash
scripts/dev-stack.sh              # no seed data
scripts/dev-stack.sh --no-web     # PocketBase only (e.g. to run Playwright yourself)
scripts/dev-stack.sh --help       # all env overrides: PB_BACKEND_DIR, PB_BIN, PB_PORT, WEB_PORT, …
```

<details>
<summary>Or start the two halves manually</summary>

```bash
# 1. in allerleih-backend/
./pocketbase serve --http=127.0.0.1:8090
./pocketbase superuser upsert you@example.com yourpassword

# 2. in share-mvp/ — with PUBLIC_PB_URL=http://127.0.0.1:8090/ in .env
npm run dev
```

</details>

### 5. Log in

The `e2e` seed scenario creates `e2e_owner_seed` (owns one public item) and `e2e_viewer_seed`, both with password `password123`.

You can also register a fresh account through the UI and log in straight away — login is not gated on email verification. The verification mail just won't arrive unless the backend has SMTP configured, so flip `verified` by hand in the PocketBase admin UI (`http://127.0.0.1:8091/_/`) if you need to exercise a verified-only path.

More scenarios live in `scripts/seed/scenarios/`:

```bash
npm run seed   # list available scenarios

PB_URL=http://127.0.0.1:8091 \
PB_SUPERUSER_EMAIL=admin@local.test \
PB_SUPERUSER_PASSWORD=localdev12345 \
npm run seed -- account-deletion
```

`PB_URL` defaults to `http://127.0.0.1:8090`, so pass it explicitly when your backend runs on
another port — `dev-stack.sh` uses **8091**. Seeding is idempotent and only ever touches its own
`@seed.test` records, so it is safe to re-run.

---

## Everyday commands

```bash
npm run dev          # dev server
npm run build        # production build
npm run preview      # preview the production build
npm run check        # svelte-kit sync + svelte-check (type checking)
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier
npm run test         # Vitest in WATCH mode
npx vitest run       # run all unit tests once (what CI does)
npx vitest run src/path/to/file.test.ts   # a single test file
```

---

## Run with Docker (self-hosting)

An official multi-stage image is published to GHCR by `.github/workflows/docker-publish.yaml`:
`ghcr.io/share-open-sharing-infrastructure/allerleih-frontend`. It complements the Uberspace
deploy above rather than replacing it — see [Dockerfile](Dockerfile) for the build itself and
[docs/architecture.md](docs/architecture.md#running-the-official-container-image) for the
canonical runtime-configuration reference (this section only summarizes it).

```bash
docker run -d \
  --name allerleih-frontend \
  -p 3000:3000 \
  --env-file .env \
  -e ORIGIN=https://app.example.org \
  ghcr.io/share-open-sharing-infrastructure/allerleih-frontend:latest
```

`ORIGIN` is not optional — set it to the URL users actually type, including the scheme and any
non-default port (`http://localhost:3000` for a plain local trial). Omit it and every form action,
login included, fails with "Cross-site POST form submissions are forbidden"; see
[Origin and proxy headers](#origin-and-proxy-headers) below for why.

Prefer pinning a specific version or SHA tag (`:v1.2.3`, `:sha-abc1234`) over `:latest` in
anything other than a quick trial — see the tags on the [package page](https://github.com/orgs/share-open-sharing-infrastructure/packages/container/package/allerleih-frontend).

**The browser talks to PocketBase directly** (it is never proxied through the SvelteKit server),
so `PUBLIC_PB_URL` must be the **publicly reachable** PocketBase URL, not a Docker-internal one.
A ready-made `docker compose` setup that wires both containers together lives in
[`deploy/`](deploy) — see
[docs/operations/self-hosting.md](docs/operations/self-hosting.md) for the stack plus the
first-run runbook (VAPID keys, superuser creation, SMTP, legal documents, backups).

All variables are read at **runtime** (issue #627) — the same image serves any instance. The
seven required vars are `PUBLIC_PB_URL`, `PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`, `ORS_API_KEY`, `PB_SUPERUSER_EMAIL` and `PB_SUPERUSER_PASSWORD` — the last two
are **full PocketBase superuser credentials** (unrestricted database read/write, not scoped to
any single feature), so store and rotate them like any other master secret. `MISTRAL_API_KEY` is
the only optional variable (unset ⇒ `/api/analyze-item` answers 503); the six
`PUBLIC_SITE_ORIGIN`/`PUBLIC_INSTANCE_CITY`/`PUBLIC_APP_NAME`/`PUBLIC_CONTACT_EMAIL`/
`PUBLIC_ANALYTICS_ORIGIN`/`PUBLIC_ANALYTICS_WEBSITE_ID` instance-branding vars are optional too.
See [docs/architecture.md#running-the-official-container-image](docs/architecture.md#running-the-official-container-image)
for the full reference with defaults — that table is the single source of truth, this is only a
summary.

A missing or empty required variable makes the process refuse to start (`assertRequiredEnv()`),
naming every offender — see `src/lib/server/env.ts`.

### Origin and proxy headers

**`ORIGIN` is required in essentially every deployment, not just behind a reverse proxy** — it is
the single most common self-hosting failure. adapter-node derives the expected origin from
`ORIGIN`, or else from the request's `Host` header combined with a protocol that **defaults to
`https`** when `PROTOCOL_HEADER` is unset (`get_origin()` in
`@sveltejs/adapter-node/files/handler.js`). So a container reached directly over plain HTTP —
`http://localhost:3000`, no proxy involved — derives `https://localhost:3000`, which never matches
the browser's `Origin: http://localhost:3000`, and every POST form action is rejected with
"Cross-site POST form submissions are forbidden". Set `ORIGIN` to the exact scheme, host and port
users reach the app on. See
[docs/architecture.md#running-the-official-container-image](docs/architecture.md#running-the-official-container-image)
for the full proxy-header reference (the `PROTOCOL_HEADER`/`HOST_HEADER` alternative,
`ADDRESS_HEADER`/`XFF_DEPTH` for client IPs, and the header-spoofing caveat).

## Testing

### Unit tests (Vitest)

Vitest is already a dev dependency — `npm ci` installs it, no separate install needed. Tests are co-located with the code (`*.test.ts`) and mock PocketBase rather than talking to a real one.

```bash
npm run test     # watch mode
npx vitest run   # single run, as CI does
```

Conventions and PocketBase mocking patterns are in [docs/testing-strategy.md](docs/testing-strategy.md); the `/write-tests` skill scaffolds tests to those conventions.

### End-to-end tests (Playwright)

Browser-level tests that drive the real app against a **running PocketBase with the real backend schema**. Playwright starts the dev server itself; `global-setup.ts` seeds the `e2e` scenario first.

```bash
npx playwright install chromium   # once

scripts/dev-stack.sh --no-web     # terminal 1: real-schema PocketBase on :8091

PB_URL=http://127.0.0.1:8091 \
PB_SUPERUSER_EMAIL=admin@local.test \
PB_SUPERUSER_PASSWORD=localdev12345 \
npm run test:e2e                  # terminal 2

npm run test:e2e:ui               # interactive UI mode
npm run test:e2e:report           # open the last HTML report
```

The e2e suite also runs in CI on every PR to `main` via `.github/workflows/e2e.yaml` (see the CI table below). Full details: [e2e/README.md](e2e/README.md).

---

## Contributing

### Workflow

1. **Pick or open an issue** in the [GitHub Project](https://github.com/orgs/share-open-sharing-infrastructure/projects/2). Issue templates live in `.github/ISSUE_TEMPLATE/`.
2. **Branch off `main`.** Existing branches follow `feat/…`, `fix/…`, `refactor/…`, `chore/…`, `docs/…`, or `<issue-number>-<slug>` — include the issue number where there is one so the PR can close it.
3. **Make the change**, keeping the guardrails in [.claude/CLAUDE.md](.claude/CLAUDE.md) — they encode the security and consistency rules this codebase depends on (PocketBase filter injection, trust/group visibility, Svelte 5 runes, `texts.ts`, the shared `Button` component).
4. **Run the full preflight** before opening the PR — these are exactly the gates CI enforces:

   ```bash
   npm run lint
   npm run check
   npx vitest run
   npm run build
   ```

5. **Open a PR against `main`.** Describe what changed and why, note what you ran, and link the issue (`Closes #123`). PR text is English even though the UI is German.

### What CI checks

| Workflow                   | Runs on        | Gate                                                                        |
| -------------------------- | -------------- | --------------------------------------------------------------------------- |
| `lint.yaml`                | PRs to `main`  | `npm run lint` + `npm run check`                                            |
| `vitest.yaml`              | PRs to `main`  | `npm run build`, then `npx vitest run --coverage`; posts a coverage comment |
| `e2e.yaml`                 | PRs to `main`  | Playwright e2e (`npm run test:e2e`) against a real-schema PocketBase        |
| `docker-publish.yaml`      | PRs to `main` (build-only, no push) · push to `main`/`v*.*.*` tags/dispatch (publish) | Builds the image; publishes to GHCR outside PRs — see [Run with Docker](#run-with-docker-self-hosting) |
| `deploy-to-uberspace.yaml` | push to `main` | Builds and deploys to production                                            |

The PR workflows are skipped for pull requests from forks — a maintainer runs them instead.

### Keep docs in sync

When you add, remove or rename a route, an `/api/*` endpoint, a PocketBase collection or view, a server helper, or an env var, update the matching doc in [`docs/`](docs/) **and** the router/guardrails in `.claude/CLAUDE.md` in the same change. `docs/` is published to [GitHub Pages](https://share-open-sharing-infrastructure.github.io/share-mvp/), so drift is visible.

### Cross-repo changes

Schema changes touch both repos and need a commit/PR in each — they are separate git repos with independent history. The frontend's `/schema-change` skill coordinates the backend migration, the frontend types, and the docs. Lending status literals are deliberately mirrored in `src/lib/lending.ts` and `allerleih-backend/pb_hooks/services/account.js`; changing one means changing the other in the same effort.

---

## Project layout

```
src/
├── lib/
│   ├── components/     # shared UI (ui/Button.svelte is the only button)
│   ├── server/         # server-only helpers (trust, notifications, integrations, metrics)
│   ├── types/models.ts # canonical TS types for all PocketBase collections
│   ├── texts.ts        # every German UI string
│   ├── categories.ts   # item categories (mirrored in the backend)
│   └── lending.ts      # lending status literals & groupings
├── routes/             # SvelteKit routes; mutations are form actions, not REST
└── hooks.server.ts     # authentication + authorization sequence
docs/                   # published documentation — start at docs/architecture.md
e2e/                    # Playwright specs, fixtures, global setup
scripts/                # dev-stack.sh, seed runner + scenarios
.claude/                # Claude Code guardrails, skills and review agents
```

---

## Documentation

The documentation for this project mainly lives in [docs](/docs/) and is statically rendered to our [GitHub Page](https://share-open-sharing-infrastructure.github.io/share-mvp/). Start with [architecture.md](docs/architecture.md).

| Working on…                                             | Read                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| System overview, auth flow, external APIs               | [docs/architecture.md](docs/architecture.md)                                                                          |
| Collection schemas and the `*_public` views             | [docs/data-model.md](docs/data-model.md)                                                                              |
| Domain relationships, lending lifecycle                 | [docs/domain-model.md](docs/domain-model.md)                                                                          |
| The `/search` route                                     | [docs/search-discovery.md](docs/search-discovery.md)                                                                  |
| SvelteKit form/CRUD patterns                            | [docs/best-practices.md](docs/best-practices.md)                                                                      |
| Buttons, theme tokens, white-labeling                   | [docs/design-system.md](docs/design-system.md)                                                                        |
| Writing tests                                           | [docs/testing-strategy.md](docs/testing-strategy.md)                                                                  |
| UI strings and categories                               | [docs/text-management.md](docs/text-management.md)                                                                    |
| Groups, trust and visibility                            | [docs/groups.md](docs/groups.md)                                                                                      |
| Partner catalogue integrations                          | [docs/integrations.md](docs/integrations.md)                                                                          |
| Running the sync/refresh endpoints, onboarding partners | [docs/operations/](docs/operations/)                                                                                  |
| Schema migrations                                       | [allerleih-backend README](https://github.com/share-open-sharing-infrastructure/allerleih-backend#writing-migrations) |

Issues are managed in our [GitHub Project share-mvp](https://github.com/orgs/share-open-sharing-infrastructure/projects/2).

---

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0-only)](LICENSE). This means you are free to use, modify, and distribute this software, provided that any modified version made available over a network also makes its source code available under the same license. See the [LICENSE](LICENSE) file for details.
