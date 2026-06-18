# Integration Sync — Operations

How AllerLeih keeps institutional accounts in sync with their external lending software (leihbackend, WINBIAP, …). This is the **operational** runbook — env vars, endpoints, cron, failure modes. For the architecture and how to add an integration, see [../integrations.md](../integrations.md).

## Endpoints

Both are session-unauthenticated (listed in `hooks.server.ts`'s unprotected prefixes) and protected by a bearer token matching `SYNC_SECRET`. They share one handler (`src/lib/server/integrations/syncEndpoint.ts`) and each return `{ "summaries": [...] }` — one `SyncSummary` per institution (`fetched`, `created`, `updated`, `archived`, `skipped`, `errors`, `durationMs`).

| Endpoint | What it does | Use for |
|---|---|---|
| `POST /api/sync` | Full catalogue pull: runs every registered **pull** integration, fetches each configured institution's whole catalogue, and upserts/archives its items. | Sources with a cheap bulk feed (leihbackend `item_public`). |
| `POST /api/refresh` | Per-item refresh: loads each institution's already-stored items and re-fetches them **one by one**, updating changed ones and archiving those the source no longer has. Never creates. | Sources without a practical bulk re-pull (WINBIAP WebOPAC). Pass `?institution=<users id>` to refresh just one institution; omit to refresh all. |

Each stored item is routed to whichever integration `claimsItem(item)` recognizes (by `externalUrl`/`externalId`), so leihbackend and WINBIAP items belonging to the same institution are handled correctly.

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

## Cron jobs (Uberspace)

Add to the crontab (`crontab -e`):

```cron
# Full catalogue pull for leihbackend institutions, every 15 minutes
*/15 * * * * curl -fsS -X POST https://allerleih.org/api/sync -H "Authorization: Bearer $SYNC_SECRET" >/dev/null

# Per-item refresh for WINBIAP (and any refresh-based) institutions, hourly
0 * * * * curl -fsS -X POST https://allerleih.org/api/refresh -H "Authorization: Bearer $SYNC_SECRET" >/dev/null
```

Tune the cadence to each source's freshness needs and politeness limits (per-item refresh makes one upstream request per stored item, so it is heavier per institution than a bulk pull).

## Failure modes

- **Wrong or missing `Authorization` header** — `401 Unauthorized`, no work done.
- **Missing env vars** — `503 Sync is not configured.`
- **Superuser authentication fails** — `503`; no institutions processed. Check `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD`.
- **A source instance is unreachable / errors (full sync)** — that institution's pull is aborted with zero writes (existing items untouched, nothing archived). The error is recorded in that institution's `errors` and logged via `console.error`; other institutions are unaffected.
- **Feed exceeds the item cap (full sync)** — treated as a fetch failure (zero writes, error recorded).
- **Many per-item fetches fail (refresh)** — a per-institution **circuit-breaker** aborts that institution with zero writes if ≥50% of items error, so a source outage can't mass-archive a catalogue. Individual transient errors leave their item untouched.
- **PocketBase batch write fails for some items** — that batch is skipped, the error is recorded in `errors`, and the rest of the run continues.

## Item lifecycle

- Items present in the source are created (full sync only) or updated, matched on `externalId`.
- Items previously synced but no longer in the source are archived: description prefixed with `[Nicht mehr im Bestand] ` and `status` set to `unavailable`.
- A reappearing item is automatically un-archived — the next run overwrites it with a fresh (unprefixed) description and its current status.
