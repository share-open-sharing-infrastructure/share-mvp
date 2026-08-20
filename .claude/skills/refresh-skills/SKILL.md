---
name: refresh-skills
description: Audit and update this repo's own .claude tooling — skills, agent definitions and CLAUDE.md — against the current codebase, fixing drifted file paths, function signatures, texts.ts keys, route paths, command names and guardrail claims so they don't rot. Use whenever the user asks to refresh, audit, update, or check the skills/agents/CLAUDE.md, after a change that touches something they reference (a renamed helper, a changed signature, a moved route, a changed auth rule), or when one of them turns out to be inaccurate. Run it before relying on a skill you haven't used in a while.
---

# refresh-skills

Skills encode real file paths, function signatures, `texts.ts` keys and commands — and the code
moves underneath them. A stale skill is worse than none: it leads confidently to code that doesn't
compile or, worse, silently breaks a guardrail (we have already shipped a skill with a wrong
function signature). This skill treats the skills like code: extract their checkable
claims, verify each against the current repo, and fix what drifted — without changing what a skill
is *for*. (Concrete example: when trust moved from `users.trusts[]` to the `trusts` join collection,
the `filterTrustedItems` helper was deleted — several skills still referenced it and had to be
repointed at the view rules + `$lib/server/trust.ts`.)

## 1. Scope

Operate on the whole `.claude/` tooling surface of **this** repo, because they rot as one:

1. every `SKILL.md` under `.claude/skills/*/`,
2. every agent definition under `.claude/agents/*.md` plus `.claude/review-contract.md`,
3. **`.claude/CLAUDE.md` itself** — it makes the highest-stakes claims of all (guardrails, auth
   rules, the router table, the skill/agent index) and no other automation checks it.

For anything that explicitly references the other repo — e.g. `schema-change` citing
`allerleih-backend` — verify those claims against that repo too. Don't touch tooling in other repos
otherwise.

**Verify against the branch you would ship to, not just the working tree.** A checkout sitting on a
stale feature branch makes files look missing and docs look wrong when `origin/main` has moved on.
`git fetch origin`, note how far behind you are (`git rev-list --count HEAD..origin/main`), and
re-check every apparent drift with `git show origin/main:<path>` before "fixing" it. Reporting a
finding that only exists on an old branch wastes a review cycle.

Two checks worth running mechanically, because they catch most of the rot cheaply:

- **Every cited path exists.** Extract the backtick-quoted paths and test them (mapping `$lib/` →
  `src/lib/`, and resolving `pb_hooks/`-relative citations in the backend). Placeholders like
  `<name>` and code samples like `${__hooks}/…` are not paths — skip them.
- **Every index is complete.** Compare `ls .claude/skills/` and `ls .claude/agents/` against what
  `.claude/CLAUDE.md` lists. A skill that exists but isn't indexed is a skill nobody runs.

## 2. Extract the checkable claims

For each `SKILL.md`, pull out every statement that can rot — these are facts, not prose:

- **File/dir paths** (`src/lib/server/trust.ts`, `scripts/seed/scenarios/`).
- **Imported symbols + signatures** (`isTrusting(pb, trusterId, trusteeId)`,
  `createNotification(pb, recipient, sender?, type, relatedId, body)`).
- **`texts.ts` keys** (`texts.errors.changesNotSaved`, `texts.notifications.pushTitle`).
- **Route paths / endpoints** (`/legal/accept`, `/api/contact/{id}`).
- **Commands & scripts** (`npx vitest run`, `npm test`, `npm run seed`).
- **Collection / field names** and any **line-number hints** (`~line 824`).

## 3. Verify each against the code

Use Grep/Glob/Read — don't trust memory:

- **Path** → confirm it exists (`Glob`). If moved, find the new location.
- **Signature** → grep the `export function`/`export const`/`export async function` and Read it.
  Confirm arg names, order, count, and `async`/sync. This is the highest-value check — a wrong
  signature is the failure that bites hardest.
- **`texts.*` key** → grep the dotted path in `src/lib/texts.ts`; confirm it resolves to a real entry
  (watch for duplicate parent keys — e.g. two `notifications:` blocks).
- **Command** → confirm the script exists in `package.json`.
- **Line-number hint** → it's approximate; if the thing has moved far, update the "~line N".
- **Embedded code snippet** that's meant to compile → reconcile it against the real signatures it
  uses. Where cheap, sanity-check by type-checking (`npm run check`) a throwaway use of it.

## 4. Fix the drift — facts only

Edit each `SKILL.md` to match reality, **preserving the skill's wording, structure, and intent**:

- Correct the path / signature / key / command / line hint to the current truth.
- Keep the description's *meaning* and trigger boundary intact — fix a stale path inside it, but don't
  re-scope what the skill triggers on.
- A referenced symbol that was **renamed** → update to the new name. **Removed with no replacement**,
  or a behavioural change you can't confidently map → **don't guess; flag it for the human** in your
  report and leave a clear note rather than inventing an API.

## 5. Report

Output a compact drift table and the fixes you made:

```
skill            claim                                   status     action
new-route        filterTrustedItems(items,userId,...)    DRIFTED    → helper deleted; trust is view-rule enforced, use $lib/server/trust.ts
seed-scenario    npm run seed                             ok         —
add-notification texts.notifications.pushTitle            ok         —
schema-change    allerleih-backend/pb_migrations/         ok         —
```

Use four statuses: **ok** (matches reality), **DRIFTED** (wrong value that would mislead or break —
fix it), **IMPRECISE** (points at the right thing but mis-describes it — e.g. an inline union called a
named "type", or a paraphrased command/line-hint — fix the wording), **GONE** (API removed with no
replacement — flag for the human, don't invent one).

End with anything you flagged for human judgement (GONE items, ambiguous renames). If nothing
drifted, say so plainly — a clean audit is a valid result.

## When to run

After merging changes that touch code the tooling references, before leaning on a skill you haven't
used recently, or periodically. This is the operational half of the `CLAUDE.md` "keep in sync" rule:
that rule asks each change to keep the docs aligned; this catches what slipped through.

Out of scope: anything outside this repo — a workspace-level `CLAUDE.md` above the repo root, or a
personal plan/notes folder, is the maintainer's own and is not audited from here.
