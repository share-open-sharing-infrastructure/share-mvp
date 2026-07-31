# End-to-end tests (Playwright)

Browser-level tests that drive the real app against a running PocketBase. They complement
the Vitest unit tests (which mock PocketBase) by exercising full flows — page rendering,
login, and access to protected routes.

## Prerequisites

1. **A running PocketBase with the real backend schema.** These tests expect the
   `allerleih-backend` schema (collections + API rules), not the open throwaway instance.
2. **Superuser credentials** for that PocketBase — `global-setup.ts` uses them to seed the
   deterministic `e2e` scenario before the suite runs.

The SvelteKit dev server is started automatically by Playwright (`webServer` in
`playwright.config.ts`) and pointed at `PB_URL`. If a dev server is already running on the
target port it is reused.

The quickest way to satisfy the PocketBase prerequisite locally is the stack bootstrapper,
which starts the real-schema backend (and can seed) in one command:

```bash
scripts/dev-stack.sh --no-web   # PB only, so `npm run test:e2e` starts its own dev server
```

## Running

```bash
PB_URL=http://127.0.0.1:8091 \
PB_SUPERUSER_EMAIL=you@example.com \
PB_SUPERUSER_PASSWORD=secret \
npm run test:e2e

npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:report   # open the last HTML report
```

### Environment variables

| Var                     | Default                 | Purpose                                                                |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `PB_URL`                | `http://127.0.0.1:8091` | PocketBase base URL (also passed to the dev server as `PUBLIC_PB_URL`) |
| `PB_SUPERUSER_EMAIL`    | — (required)            | superuser used for seeding                                             |
| `PB_SUPERUSER_PASSWORD` | — (required)            | superuser password                                                     |
| `E2E_BASE_URL`          | `http://127.0.0.1:5173` | app base URL                                                           |

## What it does

- **`global-setup.ts`** — health-checks PocketBase, then runs `node scripts/seed.js e2e`.
  The seed runner tears down previous `@seed.test` data first, so every run starts clean.
- **`auth.setup.ts`** — logs in as the seeded owner through the real form and saves the
  authenticated storage state to `e2e/.auth/owner.json` (git-ignored).
- **`tests/*.spec.ts`** — three projects: `public` (logged-out), `authenticated` (reuses the
  saved state), and `setup` (produces it).

## Fixtures

The `e2e` seed scenario (`scripts/seed/scenarios/e2e.js`) creates `e2e_owner_seed` (owns one
public item) and `e2e_viewer_seed`; password for both is `password123`. Credentials are
mirrored in `e2e/fixtures/users.ts` — keep the two in sync.

## Conventions

- Locate by role/label/text (`getByRole`, `getByText`), not CSS selectors.
- Web-first assertions (`await expect(locator)…`) that auto-retry; never `waitForTimeout`.
- One behavior per test. Traces are captured `on-first-retry`.

## CI

The suite also runs in CI via [`.github/workflows/e2e.yaml`](/.github/workflows/e2e.yaml), on every
PR to `main` (skipped on fork PRs, same gate as `vitest.yaml`) plus `workflow_dispatch`. The job
checks out `allerleih-backend` into `allerleih-backend/`, downloads the PocketBase release named in
the workflow, verifies its SHA256, upserts a throwaway CI-only superuser, starts it against the real
schema on `127.0.0.1:8091`, then runs this suite the same way you would locally. On failure it
uploads the Playwright report plus PocketBase's own log (`allerleih-backend/pb.log`) as artifacts —
check the latter first if the symptom is a wall of timeouts, since a PocketBase that died mid-run
looks exactly like that from Playwright's side.

### What is pinned, and what isn't

Only the **PocketBase version** is pinned — as a version _and_ a SHA256 checksum, since GitHub
release assets are mutable per tag. Bumping it is a deliberate two-line diff in the workflow.

The **backend itself is not pinned**: the job checks out `allerleih-backend` at `ref: main`, and a
branch pointer re-resolves on every run. Two consequences worth knowing before you go hunting for a
bug in your own diff:

- **A backend merge can turn a frontend PR red without the PR changing.** If a commit lands on the
  backend's `main` that breaks a flow this suite covers, every open frontend PR starts failing on
  the next run. Check the backend's recent `main` history before assuming your branch is at fault.
- **A frontend PR that needs an unmerged backend migration cannot go green.** CI only ever sees the
  backend's `main`, so a change depending on a migration still sitting in a backend PR is
  structurally unable to pass. Land the backend side first (or expect a known-red run and say so on
  the PR).

Pinning the backend to a commit SHA would trade this for the opposite failure mode — frontend PRs
silently testing against a stale schema — so the current setup is a deliberate choice, not an
oversight.
