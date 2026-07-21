# Integration Sync — Operations

How AllerLeih keeps institutional accounts in sync with their external lending software (leihbackend, WINBIAP, …). This is the **operational** runbook — config, cron, the CSV-import write path, failure modes. For the architecture and how to add an integration, see [../integrations.md](../integrations.md).

As of #487 Phase 3 **everything runs in the backend** (PocketBase JS hooks, `Allerleih-Backend/pb_hooks/integrations/`): the scheduled full-catalogue pull, the scheduled per-item refresh, and the CSV-import write path. There are no frontend sync endpoints and no shared bearer secret anymore. Institution discovery is the **`sync_config`** collection (single source of truth).

## Scheduled cron jobs

`pb_hooks/integration_sync.pb.js` registers two cron jobs; both run locally (native `$app`, per-institution `runInTransaction`, a shared `$app.store()` overlap lock — no HTTP call):

- **`integration_sync`** (full catalogue pull, `integrations/sync.js`) — pages each leihbackend institution's `item_public` feed and upserts/archives. Scheduled by `SYNC_CRON`.
- **`integration_refresh`** (per-item refresh, `integrations/refresh.js`) — re-fetches each stored item one by one, updating changed ones and archiving those the source no longer has. Never creates. Scheduled by `REFRESH_CRON`.

Configure in the **backend's** environment (full table: `pb_hooks/constants.js`):

| Variable | Example | Purpose |
|---|---|---|
| `SYNC_CRON` | `*/15 * * * *` | Schedule for the full pull; unset/empty = job disabled. |
| `REFRESH_CRON` | `0 * * * *` | Schedule for the per-item refresh; unset/empty = job disabled. |
| `INTEGRATION_ALLOW_INSECURE_URL` | `false` (default) | Allow `http://` and private/loopback source base URLs, bypassing the SSRF guard — for **both** jobs (`fetchItemById` + `fetchAllItems`). **Local dev / integration tests only — never in production.** |

Schedules are standard 5-field cron expressions (minute granularity). The jobs appear as `integration_sync` / `integration_refresh` in the PocketBase admin UI (Settings → Crons), where a superuser can also fire them manually; `GET /api/crons` and `POST /api/crons/{id}` do the same over HTTP. **Fail-soft** is per job: an invalid expression logs an error at startup and leaves that job unscheduled without affecting the sibling. `DRY_MODE=true` makes **both** jobs log and skip all upstream fetches + writes. Neither job needs `FRONTEND_URL` or any secret.

## Config source — `sync_config`

Both cron jobs (and the CSV-import refresh below) discover institutions from the **`sync_config`** collection (superuser-only; managed in the PocketBase admin UI — see [onboarding-institutional-partner.md](onboarding-institutional-partner.md)). One row per institution per integration:

| Field | Meaning |
|---|---|
| `institution` | Relation → the institution's `users` record (cascadeDelete). |
| `integration` | `leihbackend` or `winbiap`. |
| `baseUrl` | leihbackend instance origin (`https://allerlei.uber.space`) or WINBIAP WebOPAC base (`https://rblg.stadt.lueneburg.de/webopac`). |
| `itemUrlTemplate` | Optional human-facing deep-link template with `{id}`/`{iid}` placeholders. |
| `enabled` | When `false`, the backend cron skips this institution. |

The **full sync** processes only `leihbackend` rows (WINBIAP has no bulk feed, so it never appears in the pull); the **refresh** processes all enabled rows and routes each item by the config's `integration`. WINBIAP items are first brought in via the CSV import, then kept fresh by the refresh.

## CSV import (write path)

Institutions upload their catalogue as CSV at `/user/import` (SvelteKit; WINBIAP/generic format). The frontend parses + maps the CSV, then calls the backend over the **user session** (no superuser, no secret) — `pb_hooks/integration_import.pb.js`, all routes `requireAuth` + institution-only, `owner` always stamped to the caller:

| Endpoint | What it does |
|---|---|
| `POST /api/import/preview` | dryRun: computes the same diff as apply but **writes nothing**; returns `{ summary, rowActions, archiveRows }` for the preview UI. |
| `POST /api/import/apply` | Writes the mapped rows (create/update/archive) in one transaction → `SyncSummary`. **No archive-guard** — a CSV upload is a user-confirmed, authoritative full catalogue, so items absent from it are archived even beyond the 50% rate. Rows are deduped keep-last (there is no unique index on `items.externalId`). |
| `POST /api/import/refresh` | On-demand refresh of the caller's **own** items only (`findSyncConfigs` for `e.auth.id` → `refreshInstitution`) → `SyncSummary`. Backs the "Alle Gegenstände synchronisieren" button. |

The apply/refresh writes go through `$app.runInTransaction` (all-or-nothing per institution) — no PocketBase Batch API, no rate-limit batching. Owner isolation: a foreign `externalId` is simply unknown to the owner-scoped diff, so it becomes a new item owned by the caller — never a write to someone else's item; `trusteesOnly` is set on create and never touched on update.

## Operational notes

> **Pacing (refresh).** WINBIAP's per-item WebOPAC courtesy pause (`pauseMsBetweenFetches: 500`) runs in the backend via the JSVM's blocking `sleep(ms)`. The per-item refresh makes one upstream request per stored item (heavier than a bulk pull, +~0.5 s/item for WINBIAP) — size `REFRESH_CRON` conservatively; a large WINBIAP catalogue takes minutes.

> **Redirect residual (security).** The backend uses `$http.send`, which **follows** HTTP redirects and exposes neither the intermediate 3xx nor the final URL (no policy hook in the JSVM — spike #487 §4.4). The literal-URL SSRF guard (`urlGuard.js`) therefore **cannot** catch a source base URL that 302-redirects onto an internal host. Base URLs are admin-onboarded (bounded risk), but treat a partner-supplied URL as any server-side fetch target.

## Failure modes

- **A source instance is unreachable / errors (full sync)** — that institution's pull aborts with zero writes (existing items untouched, nothing archived); the error is recorded in that institution's summary `errors`, other institutions are unaffected.
- **Feed exceeds the item cap, or reports a bogus `totalPages` (full sync)** — treated as a fetch failure (zero writes, error recorded) — a silently truncated feed must never mass-archive the tail.
- **Source answers with an empty or collapsed feed (full sync)** — an **archive circuit-breaker** skips only the archive phase (creates/updates still apply) when the feed is empty or would archive ≥50% of the institution's stored items, and records an error. A genuine mass-removal must be archived manually.
- **Many per-item fetches fail or report "gone" (refresh)** — a per-institution **circuit-breaker** aborts that institution with zero writes if ≥50% of items error **or** come back "gone" (a collection-level 404 or a WebOPAC in maintenance reports every item gone), so a source outage can't mass-archive a catalogue. Transient errors leave their item untouched; individually-gone items below the threshold are archived normally.
- **A write fails mid-run** — writes run in `$app.runInTransaction` per institution, so a failed write **rolls that institution back** (all-or-nothing); the error is recorded and the other institutions still run.
- **CSV import: a row without `externalId`** — the `/api/import/*` endpoint rejects the whole request with `400` (defense-in-depth; the frontend parser also filters such rows).

## Item lifecycle

- Items present in the source are created (full sync + CSV apply) or updated, matched on `externalId`.
- Items previously synced but no longer in the source are archived: description prefixed with `[Nicht mehr im Bestand] ` and `status` set to `unavailable`.
- A reappearing item is automatically un-archived — the next run overwrites it with a fresh (unprefixed) description and its current status.
