# Integrations

**How AllerLeih ingests item catalogues from partner systems (libraries, Leihläden, other lending software) — and how to add a new one.**

**Audience:** reviewers who want to understand the ingestion flow, and contributors who want to connect their *own* lending software. If you maintain a specific integration, also read its folder's source; this document covers the shared machinery.


## Mental model

Every integration, regardless of source, converges on a single pipeline:

```
source data ──▶ (1) integration mapping ──▶ (2) MappedItem[] ──▶ (3) diffItems ──▶ (4) applyDiff ──▶ (5) PocketBase `items`
```
*Read: Whatever source data polled is (1) mapped to the internal Item data model of share/AllerLeih and converted to (2) an array of type MappedItem. A (3) difference is computed (for each item, check if it needs to be created, updated, skipped or archived). The diff is (4) applied by creating or updating existing items (5) in the connected PocketBase instance of share/AllerLeih.*

What differs between integrations is only:

1. **The ingestion trigger** — *when* and *how* items arrive.
2. **The source mapping** — how that source's records become a `MappedItem`.

Everything after `MappedItem[]` — comparing against the database, deciding what to create / update / archive / skip, and writing it in a per-institution transaction — is shared, generic **core** code that no integration should reimplement. As of #487 Phase 3 that core is the **backend Goja port** in `Allerleih-Backend/pb_hooks/integrations/` (`diff.js`, `db.js`, `sync.js`, `refresh.js`); the former SvelteKit `src/lib/server/integrations/core/` layer was removed. The only integration code still in this repo is the WINBIAP CSV parser (`winbiap/csv.ts`), which produces `MappedItem[]` for the import upload.

| Ingestion trigger | Source → `MappedItem` | Status |
|---|---|---|
| **Scheduled pull** | leihbackend HTTP `item_public` view | implemented (backend `integration_sync` cron, `pb_hooks/integrations/leihbackend.js`) |
| **Manual file push** | WINBIAP CSV upload | implemented (`winbiap/csv.ts` → `POST /api/import/apply`) |
| **Per-item refresh** | leihbackend per-record + WINBIAP WebOPAC search | implemented (backend `integration_refresh` cron + `POST /api/import/refresh`, see below) |
| **In-time / pull-on-search** | — | reserved (not built) |

### Refresh: a second, lighter pipeline

Alongside the full sync there is a **per-item refresh** for keeping already-imported items
up to date when a full re-pull isn't practical (because e.g. the data source is not well-maintained or responsive). Instead of fetching a
whole catalogue, it loads the institution's stored items and re-fetches **each one** from its source:

```
existing items ──▶ per item: claimsInstitution → claimsItem → fetchOne ──▶ found | gone | error
                                                          ▼
                              diffItems(found-items, resolved) ──▶ applyDiff (update + archive; never create)
```

- **found & changed** → update. **gone** (source no longer has it) → archive (`unavailable`).
  **error** (transient) → leave untouched.
- A per-institution **circuit-breaker** aborts with zero writes if ≥50% of the fetches for the items
  a run **claimed** error **or come back "gone"** (so a source outage — including a collection-level
  404 or an empty maintenance response — can't mass-archive the catalogue). Items of another source
  are skipped, so they never enter that rate.
- Routing is two-staged: integrations are first narrowed to those whose optional
  `claimsInstitution(institution)` accepts the institution's source (detected from its base URL,
  e.g. `/webopac` ⇒ WINBIAP), then each stored item goes to the first remaining integration whose
  `claimsItem(item)` returns true (detected from `externalUrl`/`externalId`). Both stages matter:
  `claimsInstitution` keeps leihbackend away from a WINBIAP institution, and `claimsItem` keeps it
  away from WINBIAP-shaped items *inside* a leihbackend institution — which is a real configuration
  (CSV-imported WebOPAC records next to a feed, or two `sync_config` rows for one institution). The
  full pull applies the same `claimsItem` filter to the items it diffs against.
- Discovery is shared (`findSyncConfigs`, reading the `sync_config` collection). The scheduled
  `integration_refresh` cron refreshes every configured institution; an institution can also refresh
  its **own** items on demand via `POST /api/import/refresh`.


## Code layout

The generic core + all concrete pull/refresh integrations live in the **backend** (PocketBase JS
hooks, Goja runtime). The frontend keeps only the CSV parser.

```
Allerleih-Backend/pb_hooks/
├── integration_sync.pb.js      # registers the integration_sync + integration_refresh cron jobs
├── integration_import.pb.js    # POST /api/import/{preview,apply,refresh} (CSV write path, requireAuth)
└── integrations/               # generic core + concrete integrations (Goja, ES5-ish)
    ├── types.js                # SYNCED_FIELDS, makeSummary, errorMessage, logIntegrationSummary
    ├── diff.js                 # diffItems + DESCRIPTION_PREFIX/archiveDescription (pure)
    ├── db.js                   # findSyncConfigs (discovery via sync_config), loadExistingItems, applyDiff
    ├── sync.js                 # runSync() full pull + archive-guard + getPullIntegrations()
    ├── refresh.js              # runRefresh() per-item + circuit-breaker + getRefreshIntegrations()
    ├── import.js               # CSV apply/preview/refresh (reuses diff.js/db.js/refresh.js)
    ├── urlGuard.js             # SSRF guard on source base URLs
    ├── leihbackend.js          # leihbackend fetchAllItems/fetchItemById + mapItem
    └── winbiap.js              # WINBIAP WebOPAC fetchItemStatus + claims logic

Allerleih/ (this repo)
└── src/lib/server/integrations/winbiap/csv.ts   # CSV → MappedItem[] parser (import upload only)
```

The **core (`diff.js`/`db.js`) never imports a concrete integration.** Concrete integrations
(`leihbackend.js`, `winbiap.js`) are listed in the ordered registries `getPullIntegrations()`
(sync) and `getRefreshIntegrations()` (refresh) — there is no separate `registry.ts` anymore.


## What the core guarantees

- **Idempotent upsert keyed on `(owner, externalId)`.** Each integration sets a stable `externalId` per item; re-running a sync with unchanged source data produces zero writes.
- **Change detection.** `diffItems` compares the synced fields (`name`, `description`, `status`, `place`, `externalUrl`, `externalImgUrl`, `categories` — order-independent) and **skips** items that are unchanged.
- **Archiving, not deleting.** Items that disappear from the source are set to `status: 'unavailable'` and their description is prefixed with `DESCRIPTION_PREFIX` (`integrations/diff.js`). Already-archived items are not re-archived. A reappearing item is un-archived by the normal update path.
- **Transactional writes.** `applyDiff` writes each institution's creates/updates/archives via native `$app` inside one `$app.runInTransaction` (all-or-nothing per institution) — no rate-limit batching, no PocketBase Batch API. Updates touch only the synced fields (`owner`/`trusteesOnly` are never overwritten on update).
- **Runs elevated in the backend.** The cron jobs and the `/api/import/*` handlers write via `$app` (the CSV path stamps `owner = e.auth.id`) — no superuser HTTP client, no `RetryWrapper`, no auth-retry wrapper. Discovery is `findSyncConfigs` over the `sync_config` collection.
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

> **Lending explanation is per institution, not per item (#368).** The "how borrowing works"
> text shown on an external item's detail page lives on the owner's `users` record
> (`externalLendingInfo`), maintained by the institution in its profile — it is **not** part of
> `MappedItem`, so importing/refresh never carries it. When empty, the item page shows a shared
> default text.

---

## Triggering & operations

As of #487 Phase 3 the sync/refresh logic runs **entirely in the backend** (PocketBase JS hooks in
`Allerleih-Backend/pb_hooks/integrations/`); there are no frontend sync endpoints or bearer secret.
Two cron jobs — `integration_sync` (full catalogue pull) and `integration_refresh` (per-item
refresh) — are driven by `SYNC_CRON` / `REFRESH_CRON` and discover institutions from `sync_config`.
See [operations/integration-sync.md](operations/integration-sync.md) for env vars, cron lines, and
failure modes.

The WINBIAP CSV import is triggered by an institution uploading a file at `/user/import`; the
frontend parses/maps the CSV and POSTs the mapped rows to the backend over the user session —
`POST /api/import/preview` (dryRun diff) then `POST /api/import/apply` (owner-scoped write). The
same page's refresh button calls `POST /api/import/refresh`.

> **Trying it out:** the import page offers a minimal downloadable template
> (`static/templates/items-import-template.csv`). For a fuller manual test there is
> [`examples/import-test.csv`](examples/import-test.csv) — it exercises multi-category rows,
> external image URLs, `trusteesOnly`, an `unavailable` item, two intentionally invalid rows
> (missing `name`, unknown category) that must show up as errors in the preview, and a duplicate
> `externalId` that must produce a warning. Re-uploading the same file after applying it should
> report every row as `skip`.

> **Discovery via `sync_config`:** institution discovery reads the `sync_config` collection (one
> row per institution per integration: `institution`, `integration`, `baseUrl`, `itemUrlTemplate`,
> `enabled`). The `integration` field is authoritative — the full sync only pulls `leihbackend`
> rows (WINBIAP has no bulk feed and never enters the pull), and refresh routes each stored item by
> it. (This replaced the former overloaded `users.leihbackendUrl` field, removed in #487 Phase 3.)

---

## How to add a scheduled-pull integration

A new integration is a new **backend** module in `Allerleih-Backend/pb_hooks/integrations/`
(Goja/ES5-ish JS, no npm/TS). Use `leihbackend.js` (pull) or `winbiap.js` (refresh) as the worked
example. Steps:

1. **Add the source type** to the `sync_config.integration` select (a backend migration) so
   institutions can be configured for it, and add a `sync_config` row per institution
   (`baseUrl`, `itemUrlTemplate`, `enabled`).
2. **Write the module** `pb_hooks/integrations/<name>.js`: a fetch function (using `$http.send` +
   `assertPublicHttpUrl` from `urlGuard.js`) and a `mapItem` that converts one source record into a
   `MappedItem` (the fields in the table above). Keep the mapping pure.
3. **For a bulk pull:** export a pull integration `{ id, fetchAndMap(institution) }` and add it to
   the ordered array in `sync.js` `getPullIntegrations()`. For a **per-item refresh:** export a
   refresh integration `{ id, claimsInstitution, claimsItem, fetchOne, pauseMsBetweenFetches? }` and
   add it to `refresh.js` `getRefreshIntegrations()` (catch-all integrations go **last** — order is
   security-relevant, so a catch-all `claimsItem` can't grab another source's items).
4. **Discovery is shared** — `findSyncConfigs(app, { integration })` in `db.js` reads the
   `sync_config` rows for you; you don't write discovery. The diff/write (`diff.js`/`db.js`) and the
   transaction wrapper are shared too; you only add the source-specific fetch + map.
5. **Add tests** to the backend harness (`Allerleih-Backend/tests/`, `node --test` against a real
   throwaway PocketBase) — see `integration-sync.test.mjs` / `integration-refresh.test.mjs`.

A manual file-push integration (like WINBIAP's CSV) only needs a `MappedItem[]` producer: the
parser stays in the frontend (`winbiap/csv.ts`), and the upload POSTs the mapped rows to the
backend `POST /api/import/apply`, which runs the same shared `diff.js` + `db.js`.
