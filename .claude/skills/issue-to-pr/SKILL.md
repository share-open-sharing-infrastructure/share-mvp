---
name: issue-to-pr
description: >
  Drive a single issue through the full AllerLeih delivery pipeline as an interactive
  orchestrator: plan → code → review → fix-loop → test → manual-test gate → commit + PR.
  Each stage runs as a dedicated sub-agent and MUST consult the applicable project skills and
  CLAUDE.md guardrails. TRIGGERS: "address issue", "fix issue", "work on issue", "implement
  issue", or any GitHub issue number or URL handed over for delivery — invoke this skill
  immediately, before any research or coding. Two human gates: plan approval and manual-test OK.
---

# issue-to-pr

You are the **orchestrator**. You do not write the feature code, review, or test yourself —
you spawn a dedicated sub-agent for each stage (Agent tool, `run_in_background: false` so you
get the result before continuing), enforce the loop logic, and stop at the two human gates.

**Repos** — frontend and PocketBase backend are **sibling directories in the same workspace**:
- Frontend (this repo, SvelteKit) — git repo. Its skills live in `.claude/skills/`.
- Backend (`Allerleih-Backend` / `allerleih-backend`, PocketBase hooks + migrations) — separate
  git repo, skills in its own `.claude/skills/`.
- An e2e worktree may sit alongside; a local PocketBase data dir / helper-scripts dir are not git
  repos. Commits & PRs only ever apply to the frontend and backend repos.

**Cross-cutting rule for EVERY stage:** the sub-agent must be told to (a) obey the relevant
`CLAUDE.md` guardrails of whichever repo it touches, and (b) consult the applicable skills of
that repo before acting. Name the concrete skills in the sub-agent's prompt (lists below).

## Stage 0 — Intake & branch

1. Get the issue from the user (pasted text, an issue number, or a URL). If it's a number/URL,
   read it (`gh issue view <n>` in the relevant repo). Summarise the goal in one or two German
   sentences and confirm you understood it.
2. Decide which repo(s) the issue touches (frontend, backend, or both).
3. In each affected repo, ensure a feature branch exists — never work on `main`:
   `git -C <repo> branch --show-current`; if `main`, create `feat/<kebab-summary>` (or `fix/…`).
   Do the same branch name in both repos when the change spans both.

## Stage 1 — Plan (sub-agent: `Plan`, read-only)

Spawn the built-in `Plan` agent. Prompt it to:
- Read the issue, the affected repo's `CLAUDE.md` (+ the workspace `CLAUDE.md` if one exists above
  the repos), and the docs
  the router points to (`docs/architecture.md`, `docs/data-model.md`, `docs/search-discovery.md`,
  `docs/domain-model.md`, `docs/groups.md`, etc. as relevant).
- Identify which project skills the coding stage will need (e.g. `new-route`,
  `add-notification-type`, `schema-change`, backend `new-migration`, `write-tests`).
- Produce a concrete, file-level, step-by-step implementation plan **honouring the guardrails**
  (pb.filter, trust/group visibility, runes, form actions, texts.ts, displayName, public-view
  leakage). For schema work the plan must cover both repos (migration → models.ts → docs).

**HUMAN GATE 1 — plan approval.** Present the plan to the user in German and ask for an OK or
changes. Do not start coding until the user approves. Incorporate requested changes (re-run the
Plan agent if the change is substantial).

## Stage 2 — Code (sub-agent: `allerleih-coder`)

Spawn the `allerleih-coder` agent with the approved plan. It already carries the project
knowledge, guardrails, and tooling rules below — still hand it the concrete plan and reinforce:
- The full approved plan and the target repo(s).
- **Obey the guardrails verbatim.** They are defined once, in the target repo's `CLAUDE.md`
  ("Guardrails (always apply)") — the coder already reads them and its own agent file points there.
  Don't re-derive or relax them; this prompt deliberately does not restate them.
- **Use the Svelte MCP server** (`svelte` — `list-sections`, `get-documentation`,
  `svelte-autofixer`, `playground-link`) for any Svelte 5 / SvelteKit API question and to
  autofix components after writing them — do not rely on training memory for Svelte APIs.
- **Use Context7** for other external libraries/APIs when unsure of a signature.
- **Use the applicable skills** rather than hand-rolling: frontend `new-route`,
  `add-notification-type`, `schema-change`, `seed-scenario`, `write-tests`, `accessibility-review`;
  backend `new-migration`, `write-tests`. For schema changes drive `schema-change` (frontend) +
  `new-migration` (backend) so both repos stay in sync.
- Add/extend tests per `write-tests` for any new server logic or route.
- Report back: files changed per repo, and a short note of which skills/guardrails it applied.

## Stage 3 — Review (four role agents, in parallel)

Fetch the diff **once** (`git -C <repo> diff main...HEAD` + working tree for both repos), then
spawn the applicable reviewer roles **in one message**, passing the diff text in the prompt —
never let four agents re-derive it themselves. They share the contract in
`.claude/review-contract.md` (in the frontend repo's root) (scope, severity, output format, beat
boundaries, cost rules); pass that path too.

**Only start a role whose gate applies** — an agent that cannot find anything still costs:

| Agent | Beat | Gate |
|---|---|---|
| `sveltekit-pb-reviewer` | pb.filter injection, trust/group visibility & `items_public`/`users_public`/`items_searchable` leakage, auth, PII/GDPR | server code, routes, hooks, migrations, PB queries, auth, personal data |
| `code-quality-reviewer` | file length, complexity, duplication, abstraction altitude, anti-patterns | ≥ 80 changed lines, or a new file, or a touched file over the length threshold |
| `a11y-reviewer` | semantics, focus, ARIA, keyboard, contrast | `.svelte` files with markup changes |
| `conventions-reviewer` | runes rules, `texts.ts`, `Button.svelte`, `displayName()`, `subscribeRealtime()`, test conventions | frontend `src/` or backend `pb_hooks/` |

**Diff ≤ 40 lines over ≤ 3 files: skip the agents and review it yourself** against the four
checklists — spawning four agents for a two-liner is pure waste.

Each returns a concrete findings list (file:line + fix, severity), empty if clean. **Dedupe**
before acting: same spot from two roles ⇒ one finding, higher severity. Run the built-in
`/security-review` as a second lens **only** for genuinely security-critical diffs (auth,
visibility rules, new public routes) — routinely it just duplicates `sveltekit-pb-reviewer`.

## Stage 4 — Fix loop (coder ↔ reviewer)

While the reviewers return findings:
1. Send the **consolidated, deduped** findings back to the `allerleih-coder` agent to fix them —
   fixes only, no scope creep.
2. Re-run the reviewer roles on the new diff. **Only re-run the roles whose findings were fixed** —
   that saves tokens and time; do a full re-run of all four only when the fix reworked things
   substantially.
3. Repeat until the reviewers return **no findings** above Nice-to-have.

Cap at **5 rounds**. If still not clean after 5, stop and surface the remaining findings to the
user with your assessment — do not loop forever or silently accept them.

## Stage 5 — Test (sub-agent: `allerleih-tester`)

Spawn the `allerleih-tester` agent. It scopes itself to the diff's impact set (changed files +
what depends on / exercises them) and runs, in order, reporting each result plainly:
1. **Unit/integration:** frontend `npx vitest run`; backend `npm test` (node --test). All green.
2. **E2E suite:** frontend Playwright — `npm run test:e2e` (see `e2e/README.md`; needs a running
   PocketBase + superuser creds). Use the `drive-app` skill's stack-bringup
   (`scripts/dev-stack.sh --seed e2e`, ports PB `127.0.0.1:8091` / web `127.0.0.1:5173`,
   superuser `admin@local.test` / `localdev12345`, plus its background-task reap gotcha).
3. **Interactive smoke, when it adds something the specs didn't:** with the stack up, exercise the
   changed flow in the browser using whichever browser MCP the session has (Playwright or Chrome
   DevTools — the user's choice) — navigate, click, snapshot, read console messages and network
   requests, screenshot the end state, and run a Lighthouse/perf audit only when the change is
   UI/perf-relevant. Watch for console errors and failed requests. If step 2's specs already cover
   the changed flow and passed, skip this and **record it as skipped**, not as passed.

Because the tester runs with the full tool set (its browser-MCP tool names can't be safely
allowlisted), its read-only contract is enforced here by post-condition: snapshot
`git -C <repo> status --porcelain` before spawning it, compare afterwards, and treat any change to
tracked files as a failed run instead of a pass.

If anything fails, hand the failure back into the Stage 4 fix loop (coder → reviewer → tester)
until green. Report the full test summary.

## Stage 6 — HUMAN GATE 2: manual test

When all automated tests pass, **stop** and output a clear German instruction block so the user
can test it themselves. Include:
- How to bring the stack up (`scripts/dev-stack.sh --seed e2e`, or ask them to run it via
  `! …` so it survives), the URLs, and the seed login.
- A concrete step-by-step checklist of exactly what to click / verify for this change, plus any
  edge cases the reviewer flagged.

Then wait. **Do not commit or open a PR until the user explicitly gives the OK.** If the user
reports a problem, feed it back into the Stage 4 fix loop.

## Stage 7 — Ship (skill: `create-pr`)

Only after the user's explicit OK:
1. Show `git -C <repo> status` for each affected repo; never stage `.env`, secrets, or coverage.
2. Commit the changes with a clear message referencing the issue.
3. Open the PR to `main` via the **`create-pr`** skill (it runs the lint/check/test/build
   preflight and drafts title/body). For a two-repo change, open a PR in each repo and
   cross-link them in the bodies.
4. Report the PR URL(s) back to the user.

## Notes

- Run each sub-agent synchronously (`run_in_background: false`) — every stage depends on the
  previous one's result.
- Keep the whole run on feature branches; the only pushes happen inside `create-pr` at Stage 7.
- If a stage needs a decision only the user can make (ambiguous issue, product trade-off), ask —
  don't guess.
