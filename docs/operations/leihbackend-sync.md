# leihbackend Sync

How AllerLeih keeps institutional accounts (e.g. Commons Zentrum, Mosaique) in sync with their leihbackend ("Leihladen") inventory.

## How it works

`POST /api/sync` runs every registered scheduled-pull integration. The leihbackend integration fetches the `item_public` view from every institution that has `isInstitution = true` and a non-empty `leihbackendUrl`, maps the records to AllerLeih `items`, and upserts/archives them under that institution's account. See `docs/integrations.md` for the overall architecture and `docs/leihbackend-integration-spec.md` for the leihbackend-specific field mapping and sync algorithm.

The endpoint is unauthenticated by session (it's listed under `/api/sync` in `hooks.server.ts`'s unprotected prefixes) but requires a bearer token matching `SYNC_SECRET`.

## Required environment variables

| Variable | Purpose |
|---|---|
| `PB_SUPERUSER_EMAIL` | PocketBase superuser used to read/write items across institutional accounts |
| `PB_SUPERUSER_PASSWORD` | Password for the above |
| `SYNC_SECRET` | Bearer token the cron job must send in the `Authorization` header |

If any of these are missing, the endpoint responds `503 Sync is not configured.`

## Per-institution configuration

Set on the institution's `users` record in the PocketBase admin dashboard:

- `leihbackendUrl` — bare origin of the institution's leihbackend instance (no trailing slash, no `/api`), e.g. `https://allerlei.uber.space`. Required for the institution to be picked up by the sync.
- `leihbackendItemUrlTemplate` — optional deep-link template for the item detail page, e.g. `https://allerlei.uber.space/reservierung/{iid}`. Placeholders `{id}` and `{iid}` are substituted with the leihbackend record id / inventory number. Leave empty if there's no public catalogue page — items then use AllerLeih's normal request flow.

## Manual trigger

```bash
curl -X POST https://allerleih.org/api/sync \
  -H "Authorization: Bearer $SYNC_SECRET"
```

Returns `{ "summaries": [...] }` with one `SyncSummary` per institution (`fetched`, `created`, `updated`, `archived`, `skipped`, `errors`, `durationMs`).

## Per-item refresh (`POST /api/refresh`)

A lighter operation that **keeps already-imported items up to date** without a full catalogue
re-pull. It loads each institution's stored external items and re-fetches **each one** from its
source, then updates changed items and archives those the source no longer has. It **never
creates** items. Same bearer-secret auth as `/api/sync`:

```bash
# Refresh every configured institution
curl -X POST https://allerleih.org/api/refresh \
  -H "Authorization: Bearer $SYNC_SECRET"

# Refresh a single institution by its users-record id
curl -X POST "https://allerleih.org/api/refresh?institution=<institutionId>" \
  -H "Authorization: Bearer $SYNC_SECRET"
```

An unknown or unconfigured `institution` id returns a single `SyncSummary` carrying an error
(and writes nothing).

- **Sources & routing:** each stored item is routed by its `externalUrl`/`externalId` — a
  `/webopac/` URL or a `118$…` id is a **WINBIAP** item (status-only refresh via the WebOPAC
  `Job=Search` API), everything else is a **leihbackend** item (all fields re-mapped via per-record
  fetch).
- **Gone vs transient:** an item the source no longer returns is archived (`unavailable` +
  `[Nicht mehr im Bestand] ` prefix); a transient fetch error leaves the item untouched.
- **Circuit-breaker:** if ≥50% of an institution's per-item fetches error (likely a source
  outage), that institution is **aborted with zero writes** so the catalogue isn't mass-archived.

### WINBIAP refresh prerequisites

- The institution's `users.leihbackendUrl` holds its **WebOPAC base** (e.g.
  `https://rblg.stadt.lueneburg.de/webopac`); refresh calls `{base}/service/cataloguedata.aspx`.
- Items must carry the full `{libraryId}${Mediennummer}` barcode as `externalId` (e.g. `118$60449822`).
- Only `status` is refreshed for WINBIAP items (name/description/`trusteesOnly` from the CSV import
  are preserved). Status comes from the catalogue record's exemplar `StatusId`s (1 = available).

### Cron job

```cron
# Full pull (leihbackend) — every 15 min
*/15 * * * * curl -fsS -X POST https://allerleih.org/api/sync -H "Authorization: Bearer $SYNC_SECRET" >/dev/null
# Per-item refresh (e.g. WINBIAP) — hourly; WINBIAP fetches are paced, so allow time
0 * * * * curl -fsS -X POST https://allerleih.org/api/refresh -H "Authorization: Bearer $SYNC_SECRET" >/dev/null
```

## Cron job (Uberspace)

Add to the crontab (`crontab -e`) to sync every 15 minutes:

```cron
*/15 * * * * curl -fsS -X POST https://allerleih.org/api/sync -H "Authorization: Bearer $SYNC_SECRET" >/dev/null
```

## Failure modes

- **leihbackend instance unreachable or returns an error** — that institution's sync is aborted with zero writes (existing items stay as they are, nothing is archived). The error is recorded in that institution's `errors` array and logged via `console.error`. Other institutions are unaffected.
- **leihbackend feed exceeds 5000 items** — treated the same as a fetch failure (zero writes, error recorded).
- **Superuser authentication fails** — the whole request responds `503`; no institutions are synced. Check `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD`.
- **Wrong or missing `Authorization` header** — `401 Unauthorized`, no work is done.
- **PocketBase batch write fails for some items** — that batch's items are not created/updated/archived; the error is recorded in `errors` and the rest of the sync continues.

## Item lifecycle

- Items present in the feed are created or updated (matched on `externalId`).
- Items previously synced but no longer in the feed are archived: description gets prefixed with `[Nicht mehr im Bestand] ` and `status` is set to `unavailable`.
- If an archived item reappears in the feed, it is automatically "un-archived" — the next sync overwrites it with a fresh (unprefixed) description and its current status.
