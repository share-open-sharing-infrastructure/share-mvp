---
name: review-and-test
description: >
  Review-and-verify workflow for AllerLeih: review the current change for security & project
  correctness, and verify it end-to-end in a real browser — then report. Runs four specialised
  reviewer roles in parallel (security & data protection, code quality, accessibility,
  conventions) plus allerleih-tester for the browser + test drive via the Chrome DevTools MCP,
  and produces one consolidated report.
  READ-ONLY: it changes no code, runs no fix-loop, opens no PR. Use when you have a change on a
  feature branch (or uncommitted) and want it reviewed and browser-tested without shipping it.
---

# review-and-test

You are the **orchestrator**. You do **not** review or test yourself — you spawn the two
dedicated sub-agents (Agent tool, `run_in_background: false`), collect their results, and hand the
user one consolidated report. This skill is **read-only**: it never edits source or tests, never
runs a fix-loop, never commits or opens a PR. If findings/failures come back, you report them and
let the user decide what to fix (they can then run `/issue-to-pr` or fix directly).

**Repos** — frontend and PocketBase backend are **sibling directories in the same workspace**:
- Frontend (this repo, SvelteKit) — git repo.
- Backend (`Allerleih-Backend` / `allerleih-backend`, PocketBase hooks + migrations) — git repo.
- An e2e worktree may sit alongside; a local PocketBase data dir / helper-scripts dir are not git repos.

## Stage 0 — Scope

1. **Default scope = the current change vs. `main`.** In each repo determine what changed:
   `git -C <repo> diff --name-only main...HEAD` plus `git -C <repo> status --porcelain` for
   uncommitted work. If the user named a specific branch/files/feature at invocation, use that
   instead.
2. Decide which repo(s) the change touches (frontend, backend, or both). If both repos are clean
   (no diff vs. main, nothing uncommitted), say so and stop — there's nothing to review or test.
3. State the scope in one German sentence (which repo(s), roughly which flow) before spawning
   agents, so it's clear what's being covered.

## Stage 1 & 2 — Review and Test (run concurrently)

Review and browser-test are independent — spawn **all sub-agents in the same message** so they
run in parallel. All must be told to obey the relevant repo's `CLAUDE.md` guardrails and consult
its skills, and all are read-only w.r.t. source.

### Review — vier Rollen-Agents
Der Review ist auf vier spezialisierte Rollen aufgeteilt; jede hat ein eigenes Revier und teilt
sich den Kontrakt in `.claude/review-contract.md` (im Wurzelverzeichnis des Frontend-Repos) (Scope, Severity, Output-Format,
Abgrenzung). Spawn sie gegen den aktuellen Diff **jedes betroffenen Repos**
(`git -C <repo> diff main...HEAD` + Working Tree):

| Agent | Revier |
|---|---|
| `sveltekit-pb-reviewer` | PB-Filter-Injection, Trust-/Gruppen-Leakage, `items_public`/`users_public`/`items_searchable`, Auth, PII/DSGVO, Realtime-Autorisierung |
| `code-quality-reviewer` | Dateilänge, Komplexität, Duplikation, Abstraktions-Altitude, Anti-Patterns |
| `a11y-reviewer` | Semantik, Fokus, ARIA, Tastatur, Kontrast, Screenreader |
| `conventions-reviewer` | Runen-Regeln, `texts.ts`, `displayName()`, `subscribeRealtime()`, Test-Konventionen, Design-System |

Jede Rolle liefert eine Findings-Liste (**file:line + konkreter Fix**, Severity), leer wenn sauber.

**Kosten:** Hol den Diff **einmal selbst** und gib ihn den Agents im Prompt mit — sonst führen
vier Agents denselben `git diff` erneut aus. **Starte nur Rollen, deren Gate zutrifft:**
`sveltekit-pb-reviewer` bei Server/Routen/Hooks/Migrations/Auth/Personendaten,
`code-quality-reviewer` ab ~80 geänderten Zeilen oder einer neuen Datei, `a11y-reviewer` nur bei
Markup-Änderungen in `.svelte`, `conventions-reviewer` bei Frontend-`src/` oder `pb_hooks/`.
Bei **≤ 40 geänderten Zeilen über ≤ 3 Dateien** reviewst du selbst statt Agents zu starten.
Weggelassene Rollen im Report begründen. Das eingebaute `/security-review` nur als zweite Linse
bei wirklich sicherheitskritischen Diffs — nicht routinemäßig.

Melden zwei Rollen dieselbe Stelle: im Report **einmal** aufführen, mit der höheren Severity.

### Test — sub-agent `allerleih-tester`
Spawn it to verify the change end-to-end, scoped to the diff's impact set. It:
1. Runs the relevant **unit/integration** tests (frontend `npx vitest run <files>`; backend
   `npm test`) — scoped, not a blanket full-suite run unless the change is broad.
2. Runs the **affected Playwright e2e specs** (`npm run test:e2e -- <spec>`).
3. Drives the changed flow **interactively in a real browser** via the **Chrome DevTools MCP**
   (`chrome-devtools` — `navigate_page`, `click`, `take_snapshot`, `list_console_messages`,
   `list_network_requests`, `take_screenshot`, and `lighthouse_audit` when UI/perf-relevant) and
   the Playwright MCP — watching for console errors and 4xx/5xx from the changed endpoints.

Stack bring-up (per the tester's own instructions / `drive-app` skill):
`scripts/dev-stack.sh --seed e2e` → PB `127.0.0.1:8091`, web `127.0.0.1:5173`, superuser
`admin@local.test` / `localdev12345`. **Background-task reap gotcha:** a PB `serve` started as a
Claude background task dies after ~1–2 min — if the tester hits this, ask the user to run the
stack via `! scripts/dev-stack.sh --seed e2e` so it survives, then re-drive promptly.

## Stage 3 — Consolidated report

Once all agents return, output **one** German report:

- **Scope** — which repo(s) and flow you covered (and, if the tester narrowed/widened scope, why);
  which reviewer roles ran, and which were skipped for lack of relevant changes.
- **Review** — findings grouped by severity (nicht nach Rolle), each as `file:line` + the concrete
  fix, with the reporting role in brackets. Dedupe: dieselbe Stelle nur einmal, mit der höheren
  Severity. "Keine Findings" if clean. Note if `/security-review` was also run.
- **Test** — the impact set the tester derived; each thing it ran (vitest / backend / e2e /
  browser smoke) with PASS/FAIL; every failure with the exact error / console message / failing
  request + screenshot.
- **Fazit** — one-line verdict: is the change safe & working, or what blocks it.

Then **stop.** Do not fix anything. If there are findings/failures, remind the user they can run
`/review-all` (dieselben Rollen, aber inklusive Fix-Durchlauf mit Änderungsprotokoll — ohne
Browser-Test) oder `/issue-to-pr` (fix-loop → tests → PR) — this skill's job ends at the report.

## Notes

- Run the sub-agents with `run_in_background: false`; launch them all in one message for concurrency.
- Never stage, commit, or push anything. Never edit source or tests.
- If the scope is ambiguous (which branch? which feature?), ask the user once rather than guessing.
