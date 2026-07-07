---
name: drive-app
description: Bring up the local AllerLeih stack and drive the running app in a browser via the Playwright MCP — to click through a flow, verify a change end-to-end, take screenshots, or reproduce a bug in the real UI (not just tests). Use whenever the user wants to "open the app", "click through", "see it in the browser", "verify it works", or manually exercise a page. Handles this machine's stack-startup and Playwright-MCP gotchas so it works on the first try.
---

# drive-app

Drive the real AllerLeih app in a browser for interactive verification. This captures the
setup this machine needs so you don't rediscover it every session. For automated regression
tests instead, use the Playwright suite (`npm run test:e2e`, see `e2e/README.md`).

## 1. Bring up the stack

One command starts PocketBase (real schema) + the dev server + seed, with every env gotcha
baked in (trailing-slash `PUBLIC_PB_URL`, `DEV_DISABLE_MKCERT`, 127.0.0.1, absolute paths):

```
scripts/dev-stack.sh --seed e2e
```

**Reap gotcha:** a long-lived `pocketbase serve` started as a Claude **background task** gets
killed after ~1–2 min (the vite dev server survives). So either:
- ask the user to run `! scripts/dev-stack.sh --seed e2e` in their own terminal (survives), or
- start it yourself and drive the app **promptly**, restarting PB if it dies.

Ports: PB `127.0.0.1:8091`, web `127.0.0.1:5173`. Superuser `admin@local.test` /
`localdev12345`. Health-check both before driving: `curl -sf http://127.0.0.1:8091/api/health`
and `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/`.

## 2. Playwright MCP browser gotcha

The MCP browser defaults to the `chrome` channel (system Google Chrome). If `browser_navigate`
errors with "Chromium distribution 'chrome' is not found" and you can't install Chrome, point
the expected path at Playwright's own bundled chromium — no MCP restart needed. On Linux (e.g.
CachyOS, where `npx playwright install chrome` is unsupported):

```
# use the actual chromium-<n> build present in ~/.cache/ms-playwright/
sudo ln -sf ~/.cache/ms-playwright/chromium-<n>/chrome-linux64/chrome /opt/google/chrome/chrome
```

Colleagues who already have Google Chrome installed won't hit this. Repoint the symlink if
Playwright later bumps the `chromium-<n>` build number.

## 3. Log in as a seeded user

The `e2e` seed scenario creates `e2e_owner_seed@seed.test` (owns one public item) and
`e2e_viewer_seed@seed.test`; password for all `@seed.test` users is `password123` (see
`e2e/fixtures/users.ts`). Other scenarios add their own users — `npm run seed` lists them.

Login flow via the MCP browser:
1. `browser_navigate` → `http://127.0.0.1:5173/auth/login`
2. `browser_snapshot` to get field refs.
3. Fill `getByRole('textbox', { name: 'E-Mail' })` and `{ name: 'Passwort' }`, then click
   the **Anmelden** button.
4. **Stale-ref gotcha:** filling a field invalidates the snapshot's element refs, so a
   ref-based click on the submit button then fails. Click it by selector
   (`button:has-text("Anmelden")`) or re-snapshot first.
5. Success = redirect to `/` and the "Login" nav link disappears (nav shows the username).

## Driving tips

- Prefer `browser_snapshot` (accessibility tree) over screenshots for deciding actions;
  screenshots are for showing the user. Use `depth` / `target` to keep snapshots small.
- The UI is **German** — match on German role names / text ("Anmelden", "Suche",
  "Unterhaltungen", "Mein Netzwerk").
- Protected routes redirect to `/auth/login` when logged out; a landing page with
  Login/Registrieren renders at `/` for logged-out visitors.
- `/user` has no index (404 is expected); use `/user/profile`, `/user/items`.
