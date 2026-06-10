# leihbackend Sync

How AllerLeih keeps institutional accounts (e.g. Commons Zentrum, Mosaique) in sync with their leihbackend ("Leihladen") inventory.

## How it works

`POST /api/sync/leihbackend` fetches the `item_public` view from every institution that has `isInstitution = true` and a non-empty `leihbackendUrl`, maps the records to AllerLeih `items`, and upserts/archives them under that institution's account. See `docs/leihbackend-integration-spec.md` for the full field mapping and sync algorithm.

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
curl -X POST https://allerleih.org/api/sync/leihbackend \
  -H "Authorization: Bearer $SYNC_SECRET"
```

Returns `{ "summaries": [...] }` with one `SyncSummary` per institution (`fetched`, `created`, `updated`, `archived`, `skipped`, `errors`, `durationMs`).

## Cron job (Uberspace)

Add to the crontab (`crontab -e`) to sync every 15 minutes:

```cron
*/15 * * * * curl -fsS -X POST https://allerleih.org/api/sync/leihbackend -H "Authorization: Bearer $SYNC_SECRET" >/dev/null
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
