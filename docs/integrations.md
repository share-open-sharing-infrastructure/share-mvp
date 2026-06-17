# Integrations

How AllerLeih ingests item catalogues from partner systems (libraries, Leihläden, other lending software) — and how to add a new one.

**Audience:** reviewers who want to understand the ingestion flow, and contributors who want to connect their *own* lending software. If you maintain a specific integration, also read its folder's source; this document covers the shared machinery.

---

## Mental model

Every integration, regardless of source, converges on a single pipeline:

```
source data ── (1) integration mapping ──▶ (2) MappedItem[] ──▶ (3) diffItems ──▶ (4) applyDiff ──▶ (5) PocketBase `items`
```
*Read: Whatever source data is (1) mapped to the internal Item data model of share/AllerLeih as (2) an array. A (3) difference is computed (for each item, check if it needs to be created, updated, skipped or archived). The diff is (4) applied by creating or updating existing items (5) in the connected PocketBase instance of share/AllerLeih.*

What differs between integrations is only:

1. **The ingestion trigger** — *when* and *how* items arrive.
2. **The source mapping** — how that source's records become a `MappedItem`.

Everything after `MappedItem[]` — comparing against the database, deciding what to create / update / archive / skip, and writing it in rate-limited batches — is shared, generic **core** code that no integration should reimplement.

| Ingestion trigger | Source → `MappedItem` | Status |
|---|---|---|
| **Scheduled pull** | leihbackend HTTP `item_public` view | implemented (`leihbackend/`) |
| **Manual file push** | WINBIAP CSV upload | implemented (`winbiap/`, used by the import route) |
| **Scheduled pull** | WINBIAP HTTP API | planned (not built) |
| **In-time / pull-on-search** | — | reserved (not built) |

---

## Code layout

```
src/lib/server/integrations/
├── core/            # generic, integration-agnostic upsert machinery
│   ├── types.ts     # MappedItem, ExistingItem, Institution, SyncSummary, DiffResult, WriteResult, PullIntegration, RetryWrapper
│   ├── pocketbase.ts# getSuperuserClient, withAuthRetry, loadExistingItems
│   ├── diff.ts      # diffItems (pure)
│   ├── write.ts     # applyDiff (batched create/update/archive)
│   └── sync.ts      # syncInstitution, syncInstitutions, makeSummary
├── registry.ts      # all active integrations listed and called from here
├── leihbackend/     # concrete scheduled-pull integration (worked example)
└── winbiap/         # concrete CSV mapping, consumed by the import route
```

The **core never imports a concrete integration.** Concrete integrations import core. The **registry** is the only place that knows the full list of integrations.

---

## What the core guarantees

- **Idempotent upsert keyed on `(owner, externalId)`.** Each integration sets a stable `externalId` per item; re-running a sync with unchanged source data produces zero writes.
- **Change detection.** `diffItems` compares the synced fields (`name`, `description`, `status`, `place`, `externalUrl`, `externalImgUrl`, `categories` — order-independent) and **skips** items that are unchanged.
- **Archiving, not deleting.** Items that disappear from the source are set to `status: 'unavailable'` and their description is prefixed with `DESCRIPTION_PREFIX` (see `$lib/server/itemArchive`). Already-archived items are not re-archived. A reappearing item is un-archived by the normal update path.
- **Rate-limit-safe batched writes.** `applyDiff` writes in batches sized to stay under PocketBase's default `*:create` limit (creates: 15/batch with a 5.5s pause; updates/archives: 50/batch). A failed batch is recorded as an error without aborting the rest.
- **Auth retry is injected, not assumed.** Core write/read accept a `RetryWrapper`. Scheduled-pull flows pass one that re-authenticates as superuser on a 401; the user-session CSV import passes none (the default identity wrapper). This is why the same core serves both a cron-driven superuser sync and an institution uploading their own file.
- **A `SyncSummary` per institution** with counts (`fetched`, `created`, `updated`, `archived`, `skipped`), `errors`, and `durationMs`.

### `MappedItem` fields

| Field | Maps to `items.` | Notes |
|---|---|---|
| `externalId` | `externalId` | **Upsert key.** Must be stable and unique per owner. |
| `name` | `name` | Max 200 chars (enforce in your mapping). |
| `description` | `description` | Plain text. Max 4000 chars. |
| `status` | `status` | `'available' \| 'unavailable' \| 'unknown'`. |
| `categories` | `categories` | Up to 3, from AllerLeih's fixed category list (`ITEM_CATEGORIES`). Might be coming from a broader standard in the future. |
| `place` | `place` | Usually the institution's city. |
| `externalUrl` | `externalUrl` | Deep link into the source system; shows a redirecting button instead of the usual in-app request flow. |
| `externalImgUrl` | `externalImgUrl` | Externally hosted cover image; used when no PocketBase file is uploaded. |
| `owner` | `owner` | The institution's `users` id. |
| `trusteesOnly` | `trusteesOnly` | Synced items are typically `false`. |

---

## Triggering & operations

`POST /api/sync` runs every registered scheduled-pull integration. It is session-unauthenticated but requires `Authorization: Bearer $SYNC_SECRET`, and is driven by a cron job. See [operations/leihbackend-sync.md](operations/leihbackend-sync.md) for env vars, the cron line, and failure modes.

The WINBIAP CSV import is triggered by an institution uploading a file at `/user/import`; it runs the same core diff + write in-request.

---

## How to add a scheduled-pull integration

Use [`leihbackend/`](../src/lib/server/integrations/leihbackend/) as the worked example. Steps:

1. **Create a folder** `src/lib/server/integrations/<name>/`.
2. **Write the source client** (`client.ts`) that fetches the partner's catalogue, and a **mapping** (`mapping.ts`) that converts one source record into a core `MappedItem`. Keep these pure and well-tested — they are the only integration-specific logic.
3. **Define your institution type** extending `Institution` with whatever config your discovery needs (e.g. a base URL stored on the `users` record).
4. **Write discovery + fetch**: a `findInstitutions(pb)` that queries which `users` are configured for your integration, and a `fetchItems(institution)` that returns `MappedItem[]`.
5. **Export a `PullIntegration`** whose `syncAll` composes `syncInstitutions(pb, institutions, fetchItems, retry)`. For superuser-driven pulls, pass `(op) => withAuthRetry(pb, op)` as the retry wrapper.
6. **Register it** by appending to `pullIntegrations` in [`registry.ts`](../src/lib/server/integrations/registry.ts). This is the only existing file you touch.
7. **Add tests** for the mapping (pure), the discovery filter, and an integration-level `syncAll`. The core is already covered, so you only test your source-specific pieces.
8. **Add a `CODEOWNERS` entry** for your folder so changes route to you for review.

> **Note on test file names:** never prefix a test with `+` (SvelteKit reserves `+`-files for routes and the build will reject `+…test.ts`). Co-locate tests as `mapping.test.ts`, `index.test.ts`, etc.

A manual file-push integration (like WINBIAP) skips steps 3–6: it only needs a mapping from its file format to `MappedItem[]`, then a route action that calls `loadExistingItems` → `diffItems` → `applyDiff` directly.
