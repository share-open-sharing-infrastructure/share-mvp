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

The suite now also runs in CI via [`.github/workflows/e2e.yaml`](/.github/workflows/e2e.yaml), on
every PR to `main` (skipped on fork PRs, same gate as `vitest.yaml`) plus `workflow_dispatch`. The
job checks out `allerleih-backend` at a pinned `main` ref into `allerleih-backend/`, downloads a
pinned PocketBase release (the "known-good" version from that repo's README), starts it against
the real schema on `127.0.0.1:8091`, upserts a throwaway CI superuser, then runs this suite the
same way you would locally. Bumping either pin (the backend ref or the PocketBase version) is a
deliberate, reviewable diff in the workflow file — not automatic — so frontend PRs aren't silently
coupled to unrelated backend changes landing on `main`.

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
