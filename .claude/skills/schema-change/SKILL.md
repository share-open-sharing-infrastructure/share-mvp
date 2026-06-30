---
name: schema-change
description: Coordinate a PocketBase schema change across both AllerLeih repos so nothing drifts — the backend migration (delegated to new-migration), the frontend TypeScript types, the data-model docs, and a public-view leak check. Use whenever the user adds/changes/removes a field on a collection, adds a collection, or changes a `*_public` view — anything that touches the schema. The point is to stop the frontend types, docs, and the privacy views from falling out of sync with the database.
---

# schema-change

The schema lives in the **backend** repo (migrations + views), but its shadow is everywhere: frontend
types, docs, seed factories, search. A change that only lands the migration leaves the frontend
type-checking against a stale shape and — the dangerous case — can quietly expose a new field through
a public view. This skill drives the change end-to-end and keeps the pieces in lockstep.

Work through these in order; skip a step only when you can say *why* it doesn't apply.

## 1. Backend migration — delegate to `new-migration`

The migration itself is the backend repo's job. Invoke the **`new-migration`** skill in
`allerleih-backend` (`.claude/skills/new-migration/`) — it has the templates for adding a field,
changing access rules, and updating views, plus the `down()` revert and the `npm test` check (fresh
DB, all migrations + hooks). Don't hand-roll the migration here.

Two things to decide *during* the migration, because they ripple into every later step:
- **Is the field user-settable?** If not (a server/hook-maintained field like the legal-consent
  fields on `users`), stop clients writing it by **appending `&& @request.body.<field>:isset = false`
  to the collection's existing `updateRule`** — don't replace the list/view rules, add this body-guard
  (the pattern in `allerleih-backend/pb_migrations/1781900051_added_legal_fields_to_users.js`). The
  field still goes in the TS type, marked as hook-maintained.
- **Should it be visible to unauthenticated/other users?** That decides whether any `*_public` /
  `items_searchable` view changes — and drives the leak check in step 4.

## 2. Frontend types — `src/lib/types/models.ts`

Update the type to match the new shape:
- The **full collection interface** (e.g. `User`, `Item`) — add/change the field with its TS type;
  mark server-only fields optional and note they're hook-maintained.
- The **`*_public` view interface** (e.g. `UserPublic`, `ItemPublic`) — add the field **only if it
  appears in that view's SQL `SELECT`**. These interfaces must match the view column-for-column;
  a field in the interface that the view doesn't select is a lie the compiler can't catch, and a
  selected column missing from the interface makes frontend code access `undefined`.

## 3. Docs — `docs/data-model.md`

- Add the field to the collection's block in the **Mermaid ER diagram** (type + a short comment,
  e.g. `string tosAcceptedVersion "legal-consent cache — server-only"`) — this is the main doc touch
  for most fields.
- If the field changes a view's exposure or has special handling, add a note to the **views section**
  — which currently documents the `items_public` / `items_searchable` columns + masking. There is no
  `users_public` SQL block there, so a private `users` field needs only the ER-diagram entry. Docs
  publish to GitHub Pages and are part of the "keep in sync" contract.

## 4. Public-view leak check (the security-critical step)

A new field on `users` or `items` is **not** in the `*_public` / `items_searchable` views unless a
migration adds it — and it usually shouldn't be. Confirm, don't assume:
- Inspect what each view actually selects (in a `pb_migrations/*` `viewQuery`, or live:
  `app.findCollectionByNameOrId('users_public').viewQuery`).
- These are **deliberately excluded** and must stay out: `users.email`, `users.password`,
  `users.trusts`, `users.inviteCode`, raw coordinates (geolocation lives in an owner-only collection),
  and the raw `owner` relation (exposed only as `userId`). Note the two views protect differently:
  `users_public` works by **column omission** (a field that isn't in its `SELECT` is simply absent),
  while `items_public` keeps the row but **NULL-masks** content fields (`name`, `image`,
  `description`, …) for `trusteesOnly`/group-shared items — check the mechanism for the view you touched.
- If the new field genuinely should be public, add it to the view's `SELECT` in the migration **and**
  to the matching `*Public` interface (step 2) **and** the docs (step 3). If it shouldn't, verify no
  `SELECT *`-style query sweeps it in. When unsure whether something leaks, get a project-aware
  review (the `sveltekit-pb-reviewer` agent, or `/security-review`).

## 5. The usual ripple — touch what applies

- **Seed factories** `scripts/seed/lib.js` — set the field in `createUser`/`createItem`/… (required
  fields must be set; optional ones get a sensible test default). See the `seed-scenario` skill.
- **Search** `src/routes/search/searchFilter.ts` — if the field is searchable/filterable, add it to
  `buildSearchFilter()` / `buildItemFilter()` (these are typed against `ItemPublic`).
- **Texts** `src/lib/texts.ts` — German label for any user-visible field (and `ITEM_CATEGORIES` if
  it's a category enum). Never inline strings.
- **Create/edit route** (e.g. `src/routes/items/[id]/`) — add the field to the form + the action's
  validate/save logic if it's user-editable.
- **Lending requirements** — if the field is a borrower gate, register it in both
  `src/lib/server/lendingRequirements.ts` and the backend `pb_hooks/lending_requirements.pb.js`.

## Verify

Run `npm test` in the backend (migrations + hooks apply on a fresh DB) and `npm run check` in the
frontend (the types must compile against the new shape). Add/extend tests for any new server logic
(the `write-tests` skill). For a visibility-affecting change, confirm the leak check with a quick
read of the view `SELECT` — a wrong view is a privacy bug, not just a type error.
