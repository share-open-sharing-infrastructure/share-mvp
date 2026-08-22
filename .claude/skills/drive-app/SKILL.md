---
name: drive-app
description: Bring up the local AllerLeih stack and drive the running app in a browser via whichever browser MCP the session has (Playwright or Chrome DevTools) — to click through a flow, verify a change end-to-end, take screenshots, or reproduce a bug in the real UI (not just tests). Use whenever the user wants to "open the app", "click through", "see it in the browser", "verify it works", or manually exercise a page. Captures this repo's stack-startup and login gotchas so it works on the first try.
---

# drive-app

Drive the real AllerLeih app in a browser for interactive verification. For automated regression
tests instead, use the Playwright suite (`npm run test:e2e`, see `e2e/README.md`) — that is both
cheaper and repeatable, so reach for the browser only when a spec can't answer the question.

**Browser tooling is the user's choice.** Playwright MCP and Chrome DevTools MCP both work; this
skill stays neutral. Check which one the session has, use it, and say which. If neither is
connected, say so rather than insisting on a particular server.

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

## 2. If the browser won't launch

Both browser MCPs launch a real browser and can fail before any page loads — this is an
environment problem, not an app problem, so don't debug the app for it.

The common one: the server is configured for a browser **channel** that isn't installed (e.g.
Playwright MCP defaulting to system Google Chrome → "Chromium distribution 'chrome' is not
found"). Fixes, in order of preference: install the expected browser; or configure the MCP server
to use a bundled/available build instead; or fall back to `npm run test:e2e`, which brings its own
browser. Report which you did.

Local, OS-specific workarounds (symlinking a bundled chromium into a system path, etc.) belong in
your own notes, not in this shared skill — a recipe for one distro is noise or a footgun for
everyone else.

## 3. Log in as a seeded user

The `e2e` seed scenario creates `e2e_owner_seed@seed.test` (owns one public item) and
`e2e_viewer_seed@seed.test`; password for all `@seed.test` users is `password123` (see
`e2e/fixtures/users.ts`). Other scenarios add their own users — `npm run seed` lists them.

Login flow (same steps whichever MCP you use — only the tool names differ):
1. Navigate to `http://127.0.0.1:5173/auth/login`.
2. Take a snapshot to get the field handles.
3. Fill the **E-Mail** and **Passwort** textboxes, then click the **Anmelden** button.
4. **Stale-handle gotcha:** filling a field invalidates the element handles from the previous
   snapshot, so clicking the submit button by handle then fails. Either target it by selector
   (`button:has-text("Anmelden")`) or re-snapshot first.
5. Success = redirect to `/` and the "Login" nav link disappears (nav shows the username).

## Driving tips

- Prefer the accessibility-tree snapshot over screenshots for *deciding* actions; screenshots are
  for showing the user. Keep snapshots scoped (most servers offer a depth/target/element option).
- **Snapshots are the main cost.** Many actions can return a whole fresh tree, which on a
  list-heavy page is a large payload every step. Snapshot when you need it to choose the next
  target or to prove the result — not out of habit after each click.
- The UI is **German** — match on German role names / text ("Anmelden", "Suche",
  "Unterhaltungen", "Mein Netzwerk").
- Protected routes redirect to `/auth/login` when logged out; a landing page with
  Login/Registrieren renders at `/` for logged-out visitors.
- `/user` has no index (404 is expected); use `/user/profile`, `/user/items`.
