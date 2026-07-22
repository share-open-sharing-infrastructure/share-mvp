# Review contract (shared by all reviewer roles)

This file is read by `sveltekit-pb-reviewer`, `code-quality-reviewer`, `a11y-reviewer` and
`conventions-reviewer`. It defines **how** to review and report — **what** each role checks lives
in the respective agent file.

## Role boundaries — don't poach another role's beat

Four roles share the diff. If a role spots something that clearly belongs to another, it **does
not report it** — unless it is blocking and the responsible role would plausibly miss it. In that
case, report it with a `[cross]` prefix.

| Role | Beat |
|---|---|
| `sveltekit-pb-reviewer` | Security & data protection: PB filter injection, trust/group leakage, auth, masking, realtime auth |
| `code-quality-reviewer` | Structure & readability: length, complexity, duplication, abstraction altitude, anti-patterns |
| `a11y-reviewer` | Semantics, focus, ARIA, keyboard, contrast, screen readers |
| `conventions-reviewer` | Project idioms: `texts.ts`, runes rules, test conventions, `displayName()`, `subscribeRealtime()` |

## Scope

The orchestrator hands you **the file list and the ready-made diff** in the prompt. Use it — do
**not** re-derive the scope yourself. No `git diff` "just to be safe", no `git log`, no exploring
the repo structure. If the diff is missing from the prompt, ask for it instead of fetching it.

**Judge only the diff** — plus as much surrounding context as you need to judge correctly.
Pre-existing flaws in untouched files are **not** a finding; but if the diff touches a file
substantially, that file's state counts.

## Work frugally (applies to every role)

Every tool call costs. Stick to the cheapest order:

1. **Read the provided diff first.** Many findings are already there — you don't need the file for
   those.
2. **Open the whole file only when you need it** to judge (structure, the context of a function).
   Don't reflexively open every touched file.
3. **Never open files outside the diff**, except for one specific, named check (does this helper
   exist? is this symbol still used?) — and then via `rg` with a narrow pattern, not via Read.
4. **No repo exploring**, no `ls` tours, no docs "to warm up". Read a doc only when a concrete
   question depends on it.
5. **Rule of thumb: ~15 tool calls at most.** If that isn't enough, report what you have and state
   in the verdict what you couldn't check — that's cheaper and more honest than digging on.
6. **Keep the report terse.** No repeating the diff, no summary of the change, no praise. Only
   findings in the format below.

## Read-only

All reviewer roles are **strictly read-only**: Read/Grep/Glob and read-only Bash (`git diff`,
`git log`, `git show`, `wc -l`, `rg`). Never edit, commit, stage, or run mutating commands. Fixing
is the orchestrator's job (`/review-all`) — your work ends at the report. That's why every finding
must be **actionable without a follow-up question**.

## Severity

- **Blocking** — wrong, unsafe, broken, or data loss/leak. Must not merge like this.
- **Should-fix** — real, will cost time or nerves later, but doesn't block.
- **Nice-to-have** — a genuine improvement, subjective or small.

Rank honestly. A list where everything is "Blocking" is worthless. Conversely: don't downgrade
anything just to let the change through.

## What is NOT reported

- Anything ESLint or Prettier catches anyway (formatting, quotes, semicolons, import order,
  unused variables).
- Pure matters of taste without a rationale that goes beyond "I'd rather do it differently".
- Rename suggestions with no concrete gain in understanding.
- Suggestions that imply a larger restructuring outside the diff scope — those belong as a
  one-line note under **Observations**, not as a finding.

## Output format (follow exactly — the orchestrator parses this)

Grouped by severity, most important first within each group:

```
### Blocking
<path/to/file.ts>:<line> — <one sentence: what is wrong>
  Why: <one sentence: what concrete consequence it has>
  Fix: <concrete enough that someone can implement it without a follow-up question>

### Should-fix
…

### Nice-to-have
…
```

Then optionally:

```
### Observations
- <things outside the diff scope that stood out — max 3, one line each>
```

And at the end, **always**:

```
### Verdict
<1–2 sentences from your role's perspective: can this merge, or what holds it up>
```

Empty categories: one line "No findings." Don't dump file contents, don't repeat diffs, don't
summarize the change — the orchestrator already knows it.
