# Business Metrics — Operations

How AllerLeih computes its nightly `metrics_daily` snapshot (registered users, transactions,
active users, items on offer, funnel/impact/integration/community aggregates). This is the
**operational** runbook — what the job computes, how to re-run it, and how to add a metric. For
the collection schema see [../data-model.md](../data-model.md) → "metrics_daily".

> **Status:** backend job, storage, and both consuming frontend routes (`/admin/metrics`,
> `/misc/stats`) are live.

## What runs, and when

`allerleih-backend/pb_hooks/metrics.pb.js` registers a nightly PocketBase cron
(`metricsDailySnapshot`, `0 3 * * *` — after the 02:00–02:40 retention jobs, so a night that also
anonymizes/purges records is reflected in the same day's snapshot). The job itself
(`pb_hooks/jobs/metrics.js`) is **read-only** except for upserting exactly one row: it computes the
full metric catalog with superuser (`$app`) access and writes it to today's `metrics_daily` row
(keyed on `date`, "YYYY-MM-DD"), overwriting whatever was there — safe to re-run.

There are no configurable environment variables for this job (unlike the retention jobs) — the
30-day/7-day windows are fixed in `jobs/metrics.js`.

## Manual trigger (local / staging)

Cron schedules can't be fired on demand, so a test-only HTTP route exists for that:

```bash
# only registered when METRICS_TEST_ROUTE=true is set in the backend's environment
curl -X POST http://127.0.0.1:8090/api/_test/run-metrics-snapshot \
  -H "Authorization: Bearer $SUPERUSER_TOKEN"
```

It requires superuser auth and does not exist when `METRICS_TEST_ROUTE` is unset — **never enable
it in production**. Alternatively, trigger the registered cron directly from the PocketBase admin
UI (Settings → Crons → `metricsDailySnapshot` → Run), or start the backend and wait for 03:00.

Either way, confirm a row landed:

```bash
curl -s -H "Authorization: Bearer $SUPERUSER_TOKEN" \
  "http://127.0.0.1:8090/api/collections/metrics_daily/records?sort=-date&perPage=1"
```

## Metric catalog

Every value is a count or aggregate — no per-user data is ever included. The frontend's
`DailyMetrics` type (`src/lib/types/models.ts`, this repo) is the authoritative shape reference;
keep it in sync with `computeDailyMetrics()` in `jobs/metrics.js` when the catalog changes.

| Group | Metrics |
|---|---|
| `users` | `total` (excl. `deleted`), `institutions`, `verified` |
| `items` | `available`, `byPrivateUsers`, `byInstitutionsNative`, `external`, `externalByInstitution[]` (`{userId, username, count}`) |
| `loans` | `byStatus` (per `lendingStatus`, incl. `aborted`), `completedTotal`, `accepted30d`, `completed30d` |
| `activeUsers` | `loans30d_1plus` / `loans30d_2plus` (distinct requester-or-owner users in ≥1/≥2 conversations accepted or completed in the last 30d), `login7d`, `login30d` (via `users.lastLoginAt`) |
| `funnel` | `requests30d` (conversations created), `acceptanceRate30d` (accepted-like / (accepted-like + rejected) among requests created in the window; `null` if none decided yet), `stalePending` (pending ≥7 days with no owner reply) |
| `messages` | `total`, `last30d` |
| `impact` | `counterfactual` (count per `CounterfactualAnswer` among completed loans) |
| `integrations` | `lastSyncByInstitution[]` (`{userId, username, itemCount, newestUpdated}`, one row per institution with a `leihbackendUrl`) |
| `outboundClicks` | `total`, `last30d`, `byItemOwner30d[]` (top 20, `{userId, username, count}`), `byDomain30d[]` (top 20, `{domain, count}` — destination **hostname**, e.g. `uber.space`, not the strict DNS top-level domain; clicks with an unparseable `destination` are excluded) |
| `community` | `groups.{total,public,memberships}`, `trusts.edges`, `invites.usersInvited`, `push.{subscriptions,usersSubscribed}` |

## Known limitations

- **No backfill.** `conversations.acceptedAt`/`completedAt` are only stamped from the moment those
  fields shipped (see `lending_timestamps.pb.js`) — every time-windowed metric (`activeUsers`,
  `funnel`, `loans.accepted30d`/`completed30d`) reads as zero on old data and only fills in as real
  transitions accumulate.
- **Trend charts** (planned for `/admin/metrics`) need a few days of snapshots before they show a
  line — there is exactly one row per calendar day.
- **`lastLoginAt` is 24h-throttled** (see the auth hook in `account.pb.js`), so `login7d`/`login30d`
  are day-granular, not exact.

## Frontend routes

- **`/admin/metrics`** — gated by `users.isAdmin` (a `hidden: true` DB flag on the backend,
  set via the PocketBase admin UI — same mechanism as the existing `isInstitution` toggle;
  see `allerleih-backend/pb_migrations/1784623436_users_is_admin.js`). `isAdmin(userId)` does
  a superuser-authenticated lookup rather than checking `locals.user`, since the field is
  hidden and never present on a normal session's auth record. A non-admin gets `error(404)`,
  not 403, so the route's existence isn't advertised. Shows live counts (`getLiveCoreMetrics()`
  — users/items/loans, computed on request so they're current-day) plus everything else from
  the latest `metrics_daily` row, and trend sparklines from the last 30 days of snapshots.
  The nav shows a link to admins only (computed once in the root `+layout.server.ts` and
  passed down, for the same hidden-field reason).
- **`/misc/stats`** — public, unauthenticated. Shows the whitelisted subset returned by
  `getPublicStats()`: registered users, items available, completed loans, one impact number
  (completed loans where the borrower said they'd have bought new otherwise). Cached in-process
  for ~1h so it never hammers PocketBase. The same subset is also teased on the home page
  (`/`, via the shared `PublicStatsSection` component) — `getPublicStats()` fails soft
  (`null`) instead of throwing so a transient hiccup never takes down the landing page.
- Both read through `src/lib/server/metrics.ts` (`isAdmin`, `getLiveCoreMetrics`,
  `getMetricsHistory`, `getPublicStats`), which reuses `getSuperuserClient()`.

## Adding a new metric

1. Add the computation to the relevant `compute*` function in `jobs/metrics.js` (or add a new
   group + `compute*` function, wired into `computeDailyMetrics()`).
2. Mirror the new field(s) in `DailyMetrics` (`src/lib/types/models.ts`).
3. Update the catalog table above.
4. No migration needed — `metrics_daily.metrics` is a flexible JSON blob.
