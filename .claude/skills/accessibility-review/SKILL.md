---
name: accessibility-review
description: Audit the project's changed Svelte components for accessibility issues (aria labels, decorative SVGs, label associations, live regions, German alt text, keyboard reachability) following AllerLeih's existing a11y patterns. Use when the user asks for an a11y/accessibility review of UI changes. Reports findings; does not edit code unless asked.
---

# accessibility-review

Review the accessibility of changed UI for the AllerLeih app. This is a read-and-report
skill — produce a findings list, and only edit code if the user explicitly asks.

## Scope

Default to the diff against `main`:

```bash
git diff --name-only main...HEAD -- '*.svelte'
```

If there is no diff (or the user names files/areas), review those instead. Read each
component fully before judging — context matters (a visually-hidden label may already exist).

## Checklist

For each changed `.svelte` file, check:

1. **Icon-only / unlabeled controls** — every `<button>`/clickable with no visible text has an
   `aria-label` (German, sourced from `src/lib/texts.ts` where a string exists). Loaders/spinners
   too. Pattern reference: `src/lib/components/AllerLoader.svelte`.
2. **Decorative graphics** — purely decorative SVGs/icons/shimmer have `aria-hidden="true"` and
   no redundant label. Pattern reference: `src/routes/search/SearchBar.svelte`.
3. **Form controls** — every input/select/textarea has an associated `<label>` (`for`/`id` or
   wrapping). Error text is programmatically associated (e.g. `aria-describedby`) and not
   conveyed by color alone.
4. **Status / dynamic regions** — content that updates without navigation uses
   `aria-live="polite"` (and `aria-busy` while loading). Pattern reference:
   `src/routes/conversations/[conversationId]/+page.svelte`.
5. **Images** — `<img>` and item/profile images have meaningful German `alt` text (empty `alt=""`
   only for purely decorative images). Watch item-image components that may render no alt.
6. **Keyboard & semantics** — interactive elements are real buttons/links (not `div`/`span` with
   click handlers); `aria-pressed`/`aria-expanded` reflect toggle state (pattern:
   `src/routes/users/[id]/ItemsSection.svelte`); focus order is sensible; no positive `tabindex`.
7. **Contrast / color-only meaning** — flag obvious cases where state is signaled by color alone.

## Output

Group findings by severity (Blocking / Should-fix / Nice-to-have). For each:

```
<file>:<line> — <issue>
  Fix: <concrete suggestion, referencing the matching existing pattern>
```

End with a one-line summary (e.g. "3 should-fix, 1 nice-to-have"). If the user wants the fixes
applied, make minimal edits that follow the referenced patterns and pull strings from `texts.ts`.
