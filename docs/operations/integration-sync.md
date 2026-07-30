# Integration Sync — Operations

How AllerLeih keeps institutional accounts in sync with their external lending software (leihbackend, WINBIAP, …). This is the **operational** runbook — env vars, endpoints, cron, failure modes. For the architecture and how to add an integration, see [../integrations.md](../integrations.md).

## Endpoints

Both are session-unauthenticated (listed in `hooks.server.ts`'s unprotected prefixes) and protected by a bearer token matching `SYNC_SECRET`. They share one handler (`src/lib/server/integrations/syncEndpoint.ts`) and each return `{ "summaries": [...] }` — one `SyncSummary` per institution (`fetched`, `created`, `updated`, `archived`, `skipped`, `errors`, `durationMs`).

| Endpoint | What it does | Use for |
|---|---|---|
| `POST /api/sync` | Full catalogue pull: runs every registered **pull** integration, fetches each configured institution's whole catalogue, and upserts/archives its items. | Sources with a cheap bulk feed (leihbackend `item_public`). |
| `POST /api/refresh` | Per-item refresh: loads each institution's already-stored items and re-fetches them **one by one**, updating changed ones and archiving those the source no longer has. Never creates. | Sources without a practical bulk re-pull (WINBIAP WebOPAC). Pass `?institution=<users id>` to refresh just one institution; omit to refresh all. |

Each institution is first matched to the integrations serving its source (`claimsInstitution`, detected from the base URL — `/webopac` ⇒ WINBIAP), then each stored item is routed to whichever remaining integration `claimsItem(item)` recognizes (by `externalUrl`/`externalId`).

> **⚠️ #487 Phase 2 — BOTH scheduled jobs now run in the backend, not here.** As of Phase 2 the
> `integration_sync` (full pull) **and** `integration_refresh` (per-item) cron jobs execute
> **locally inside PocketBase** (`Allerleih-Backend/pb_hooks/integrations/`, native `$app`, a
> per-institution transaction, a shared `$app.store()` overlap lock) — no HTTP POST, no bearer
> secret, no superuser HTTP client. They discover institutions from the new **`sync_config`**
> collection (see *Config source* below), not `users.leihbackendUrl`.
>
> These frontend `/api/sync` + `/api/refresh` endpoints **still exist and are unchanged** — use
> them for a **manual** trigger (`/api/refresh?institution=<id>` for one institution). They still
> read `users.leihbackendUrl` (dual-truth interim, Phase 3 removes them). See *Scheduling* below
> for the backend config, the config source, `enabled`, the lock caveat, pacing, and the redirect
> residual.

## Prerequisite: enable the PocketBase Batch API

All integration writes (full sync, per-item refresh, **and** the CSV import at `/user/import`) go through PocketBase **batch requests** (`pb.createBatch()`), and the Batch API is **disabled by default**. On an instance running the `allerleih-backend` migrations this is handled automatically (`pb_migrations/1783101579_enable_batch_api.js` enables it). On any other PocketBase instance every write batch fails until it is enabled — enable it once, either:

- **Admin UI:** Settings → Application → enable **Batch API**, or
- **API:** as a superuser,

  ```bash
  curl -X PATCH https://<pocketbase-host>/api/settings \
    -H "Authorization: Bearer $SUPERUSER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"batch": {"enabled": true}}'
  ```

The default `batch.maxRequests` (50) is sufficient — the largest batch the integrations send is 50 operations.

## Required environment variables

| Variable | Purpose |
|---|---|
| `PB_SUPERUSER_EMAIL` | PocketBase superuser used to read/write items across institutional accounts |
| `PB_SUPERUSER_PASSWORD` | Password for the above |
| `SYNC_SECRET` | Bearer token the cron job must send in the `Authorization` header |

If any are missing, both endpoints respond `503 Sync is not configured.`

## Per-institution configuration

Set on the institution's `users` record in the PocketBase admin dashboard (see [onboarding-institutional-partner.md](onboarding-institutional-partner.md) for the full walk-through):

- `isInstitution = true` and `city` set.
- `leihbackendUrl` — the integration's base URL. Despite the name this field is the **generic base URL** for the institution's source (interim overloading; a dedicated `sync_config` collection will replace it later):
  - **leihbackend:** the bare instance origin, e.g. `https://allerlei.uber.space`.
  - **WINBIAP:** the WebOPAC base, e.g. `https://rblg.stadt.lueneburg.de/webopac`.
- `leihbackendItemUrlTemplate` — optional human-facing deep-link template with `{id}`/`{iid}` placeholders. Leave empty if there's no public catalogue page (items then use AllerLeih's normal request flow).

> **Pick the right endpoint per source.** Because `leihbackendUrl` is shared, `POST /api/sync` will also try to pull a WINBIAP institution and fail fetching `item_public` (isolated, zero writes — harmless but noisy). Run the **full sync** for leihbackend institutions and the **refresh** for WINBIAP institutions. WINBIAP items are first brought in via the CSV import at `/user/import`, then kept fresh by `/api/refresh`.

## Manual trigger

```bash
# Full pull (leihbackend)
curl -X POST https://allerleih.org/api/sync \
  -H "Authorization: Bearer $SYNC_SECRET"

# Per-item refresh — all institutions
curl -X POST https://allerleih.org/api/refresh \
  -H "Authorization: Bearer $SYNC_SECRET"

# Per-item refresh — a single institution
curl -X POST "https://allerleih.org/api/refresh?institution=<users-id>" \
  -H "Authorization: Bearer $SYNC_SECRET"
```

## Scheduling

### Built-in PocketBase cron jobs (preferred)

The backend (`allerleih-backend`, `pb_hooks/integration_sync.pb.js`) registers two cron jobs. As of **#487 Phase 2** **both** run **locally in the backend** — no HTTP POST to the frontend:

- **`integration_sync`** (full pull) — `pb_hooks/integrations/sync.js`: pages each leihbackend institution's `item_public` feed and upserts/archives, direct `$app` writes in a per-institution transaction. Needs only a valid `SYNC_CRON`.
- **`integration_refresh`** (per-item refresh) — `pb_hooks/integrations/refresh.js`: re-fetches each stored item one by one. Needs only a valid `REFRESH_CRON`.

Both **discover institutions from the `sync_config` collection** (not `users.leihbackendUrl` — see *Config source*). Configure in the **backend's** environment:

| Variable | Example | Purpose |
|---|---|---|
| `SYNC_CRON` | `*/15 * * * *` | Schedule for the local full pull; unset/empty = job disabled. **No longer needs `FRONTEND_URL`/`SYNC_SECRET`.** |
| `REFRESH_CRON` | `0 * * * *` | Schedule for the local per-item refresh; unset/empty = job disabled |
| `INTEGRATION_ALLOW_INSECURE_URL` | `false` (default) | Allow `http://` and private/loopback source base URLs, bypassing the SSRF guard — applies to **both** jobs (refresh `fetchItemById` + sync `fetchAllItems`). **Local dev / integration tests only — never set in production.** |
| `FRONTEND_URL`, `SYNC_SECRET`, `SYNC_TIMEOUT_SECONDS` | — | **No longer used by either cron job** (kept only for the frontend's *manual* `/api/sync` + `/api/refresh`; removed in Phase 3). |

Schedules are standard 5-field cron expressions (minute granularity). The jobs appear as `integration_sync` / `integration_refresh` in the PocketBase admin UI (Settings → Crons), where a superuser can also fire them manually; `GET /api/crons` and `POST /api/crons/{id}` do the same over HTTP. **Fail-soft** is per job: an invalid expression logs an error at startup and leaves that job unscheduled without affecting the sibling. `DRY_MODE=true` makes **both** jobs log and skip all upstream fetches + writes.

#### Config source — `sync_config` (Phase 2)

Both cron jobs read a **`sync_config`** collection (superuser-only) instead of `users.leihbackendUrl`. One row per institution per integration: `institution` (→ users), `integration` (`leihbackend`|`winbiap`), `baseUrl`, `itemUrlTemplate`, `enabled`. The **full sync** processes only `leihbackend` rows (WINBIAP has no bulk feed, so it never appears in the pull — the old "WINBIAP picked up by the full sync and fails" footgun is gone); the **refresh** processes all enabled rows and routes each by `integration`. Manage rows in the PocketBase admin UI (see [onboarding-institutional-partner.md](onboarding-institutional-partner.md)). A one-time backfill migration seeded rows from existing `users.leihbackendUrl` values.

> **Dual-truth interim (until Phase 3).** The **cron** reads `sync_config`; the **manual** frontend `/api/sync` + `/api/refresh` and the CSV import still read `users.leihbackendUrl`. A new partner therefore needs **both** set (onboarding double-step). `enabled=false` disables only the **cron** — a manual `/api/sync`/`/api/refresh` still processes the institution (it doesn't know about `enabled`) until Phase 3.

> **⚠️ Interim two-lock-domain caveat (until Phase 3).** The backend cron jobs share one `$app.store()` lock (`integrationRunLock`) — a sync and a refresh tick never overlap, and a second tick of either skips with a warning. But the **manual** frontend `/api/sync`/`/api/refresh` use a *separate* process-wide in-flight lock that **cannot see** the backend lock. So do **not** fire a manual frontend sync/refresh while a backend cron window is active — both write `items`.

> **Pacing (refresh).** WINBIAP's per-item WebOPAC courtesy pause (`pauseMsBetweenFetches: 500`) is preserved in the backend via the JSVM's blocking `sleep(ms)` (spike #487 §4.4). Per-item refresh makes one upstream request per stored item — heavier per institution than a bulk pull, and the WINBIAP pause adds ~0.5 s/item — so size `REFRESH_CRON` conservatively (a large WINBIAP catalogue takes minutes).

> **Redirect residual (security).** The backend uses `$http.send`, which **follows** HTTP redirects and exposes neither the intermediate 3xx nor the final URL (no policy hook in the JSVM — spike #487 §4.4). The literal-URL SSRF guard (`urlGuard.js`) therefore **cannot** catch a source base URL that 302-redirects onto an internal host. Base URLs are admin-onboarded (bounded risk), but treat a partner-supplied URL as you would any server-side fetch target. The frontend `fetch` path used `redirect: 'manual'`; that exact semantics is not reproducible in Goja.

> **Backend sync writes are transactional, not batched.** The local full sync writes each institution's creates/updates/archives in one `$app` transaction (all-or-nothing) — no rate-limit batching, no HTTP timeout. The Batch-API prerequisite above and the "long first sync" batching caveat apply only to the **frontend** manual `/api/sync` + the CSV import.

### OS crontab (fallback)

Alternatively, schedule curl from the host's crontab (`crontab -e`), e.g. on Uberspace:

```cron
# Full catalogue pull for leihbackend institutions, every 15 minutes
*/15 * * * * curl -fsS -X POST https://allerleih.org/api/sync -H "Authorization: Bearer $SYNC_SECRET" >/dev/null

# Per-item refresh for WINBIAP (and any refresh-based) institutions, hourly
0 * * * * curl -fsS -X POST https://allerleih.org/api/refresh -H "Authorization: Bearer $SYNC_SECRET" >/dev/null
```

Tune the cadence to each source's freshness needs and politeness limits.

## Failure modes

- **Wrong or missing `Authorization` header** — `401 Unauthorized`, no work done.
- **Missing env vars** — `503 Sync is not configured.`
- **Another run already in progress** — `429`; no work done. Retry after the running sync/refresh finishes (its summaries appear in the logs).
- **Superuser authentication fails** — `503`; no institutions processed. Check `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD`.
- **A source instance is unreachable / errors (full sync)** — that institution's pull is aborted with zero writes (existing items untouched, nothing archived). The error is recorded in that institution's `errors` and logged via `console.error`; other institutions are unaffected.
- **Feed exceeds the item cap (full sync)** — treated as a fetch failure (zero writes, error recorded).
- **Source answers with an empty or collapsed feed (full sync)** — an **archive circuit-breaker** skips the archive phase (creates/updates still apply) when the feed is empty or would archive ≥50% of the institution's stored items, and records an error. A source mid-migration or an emptied view can't mass-archive a catalogue; a genuine mass-removal must be archived manually (or the guard relaxed for one run).
- **Many per-item fetches fail or report "gone" (refresh)** — a per-institution **circuit-breaker** aborts that institution with zero writes if ≥50% of items error **or come back "gone"** (a collection-level 404 or a WebOPAC in maintenance reports every item gone), so a source outage can't mass-archive a catalogue. Individual transient errors leave their item untouched; individually gone items below the threshold are archived normally.
- **PocketBase batch write fails for some items (full sync)** — that batch is skipped, the error is recorded in `errors`, and the rest of the run continues.
- **A write fails during the backend refresh (Phase 1)** — refresh writes go through `$app.runInTransaction` per institution (no batching), so a failed write **rolls the whole institution back** (all-or-nothing); the error is recorded in that institution's `errors` and the other institutions still run. The Batch API prerequisite does **not** apply to the backend refresh.
- **Every batch fails (typically "Batch requests are not allowed")** — the Batch API is disabled on the PocketBase instance; see the prerequisite section above. *(Full sync + CSV import only — the backend refresh does not use batches.)*

## Item lifecycle

- Items present in the source are created (full sync only) or updated, matched on `externalId`.
- Items previously synced but no longer in the source are archived: description prefixed with `[Nicht mehr im Bestand] ` and `status` set to `unavailable`.
- A reappearing item is automatically un-archived — the next run overwrites it with a fresh (unprefixed) description and its current status.
