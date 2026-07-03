---
name: write-tests
description: Write Vitest unit tests for the AllerLeih SvelteKit frontend, following this repo's conventions (co-located *.test.ts, mocked PocketBase, testing server functions and +page.server.ts load/actions). Use whenever the user asks to write, add, or improve tests, increase coverage, or "test this" for any server-side function, form action, or load function — even if they don't say "Vitest". Reach for it before merging logic that isn't covered.
---

# write-tests (frontend)

Add tests that match how this repo already tests, so they read like the surrounding suite
and pass in CI. We test **server-side logic** — pure helpers in `$lib/server/*.ts` and a route's
`+page.server.ts` `load`/`actions` — by mocking PocketBase. UI-component rendering isn't tested
here yet; don't introduce a new harness for it without asking.

Before writing, skim a nearby test to copy the local style. Good models:
`src/lib/server/items.test.ts` (helper functions), `src/routes/legal/accept/page.server.test.ts`
(load + actions, redirects), and `docs/testing-strategy.md` (the canonical mock shape).

## 1. Where the file goes

Co-locate the test with its target, same basename + `.test.ts`:
- `src/lib/server/items.ts` → `src/lib/server/items.test.ts`
- `src/routes/legal/accept/+page.server.ts` → `src/routes/legal/accept/page.server.test.ts`

## 2. Mock PocketBase with a small factory

There's no real DB in unit tests. Build a `pb` whose `collection(name)` returns an object of
`vi.fn()` stubs for only the methods the code under test calls — e.g. `getOne`, `getFirstListItem`,
`getFullList`, `create`, `update`, `delete`. Distinguish multiple calls to the same collection by
inspecting the args (e.g. the `filter` string), and expose the stubs so you can assert on them
afterwards.

Many helpers signal "not found" by **rejecting** rather than returning null — `getOne` and
`getFirstListItem` throw when nothing matches, and the code wraps them in `try/catch`. Drive that
branch with `vi.fn().mockRejectedValue(new Error('not found'))` so you actually exercise the catch.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteItem } from './items';

function makePb({ item, openConversations = [] }) {
  const getOne = vi.fn().mockResolvedValue(item);
  const deleteRecord = vi.fn().mockResolvedValue(undefined);
  const getFullList = vi.fn(({ filter } = {}) =>
    Promise.resolve(filter?.includes('lendingStatus') ? openConversations : [])
  );
  const pb = {
    collection: vi.fn((name: string) =>
      name === 'items' ? { getOne, delete: deleteRecord } : { getFullList }
    ),
    // Mirror the real pb.filter() so the code under test can interpolate params.
    filter: (raw: string, params?: Record<string, unknown>) =>
      params ? Object.entries(params).reduce((a, [k, v]) => a.replace(`{:${k}}`, String(v)), raw) : raw,
    _deleteRecord: deleteRecord, // handles surfaced for assertions
  };
  return pb as unknown as Parameters<typeof deleteItem>[0] & typeof pb;
}
```

Always provide `pb.filter` — production code builds every filter through it (never with template
literals), so a missing mock throws. Reset state between tests with `beforeEach(() => vi.clearAllMocks())`.

**Not everything routes through `collection()`.** Some `$lib/server/*` helpers reach a privileged
backend hook via the root-level `pb.send('/api/…')`, and a few read `pb.authStore`. Stub those as
siblings of `pb.filter` on the `pb` object — `send: vi.fn().mockResolvedValue({ … })` — not inside
`collection()`, otherwise the call is `undefined` and the test throws before it asserts anything.

## 3. Testing `load` and `actions`

These take a SvelteKit request event. Build a `makeEvent({ user, form, params, … })` helper that
returns `{ locals: { pb, user }, request, url, params, … }` cast to the function's parameter type.
Put form fields into a real `FormData` and expose it via `request.formData`.

SvelteKit's `redirect()` and `error()` **throw**, so a successful redirect never returns — capture
the thrown value and assert on it:

```ts
async function capture(fn: () => unknown) {
  try { await fn(); } catch (e) { return e as { status: number; location?: string }; }
  throw new Error('expected a thrown redirect, but none was thrown');
}

const r = await capture(() => actions.accept(event));
expect(r).toMatchObject({ status: 303, location: '/items/abc' });
```

A form action that returns a `fail()` (e.g. validation error) does *not* throw — assert on the
returned object instead.

## 4. Assert behaviour, not implementation

Prefer asserting the function's return value and the PocketBase calls it made
(`expect(pb._deleteRecord).toHaveBeenCalledWith('item1')`) over internal details. Cover every branch
the function can take — owner vs. non-owner, found vs. not-found, empty input, the open-loan guard,
the security edge cases (e.g. open-redirect targets in `legal/accept`). One `it()` per branch, named
for the behaviour it pins down.

For user-facing error/success messages, assert against the constant from `$lib/texts`
(`texts.legal.accept.errors.mustAcceptAll`) rather than hard-coding the German string — strings live
in `texts.ts` and may change.

## 5. Run it

```bash
npx vitest run src/path/to/file.test.ts   # the file you just wrote, fast feedback
npx vitest run                            # full suite, the CI gate
```

`npm run test` starts Vitest in **watch** mode (handy while iterating); use `npx vitest run` for a
one-shot pass. CI runs `npx vitest run --coverage` + `npm run build` on every PR
(`.github/workflows/vitest.yaml`) and posts a coverage comment, so a new test that fails to compile
or run will block the merge — confirm it's green locally first.
