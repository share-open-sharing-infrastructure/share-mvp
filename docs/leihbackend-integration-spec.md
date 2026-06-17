# leihbackend Integration — Implementation Spec

_Created: 2026-06-10 · Status: ready for implementation (Phase 1) · Architecture decision record: see vault note "Integration leihbackend in AllerLeih-Plattform" (2026-05-11)_

This spec is written to be executed by Claude Code inside this repository. It is self-contained: all relevant facts about the external system (leihbackend) are stated here, verified against the leihbackend codebase on 2026-06-10.

> **Status update (post-implementation):** the sync machinery has since been generalized into a pluggable integration system shared with other sources (e.g. WINBIAP). The generic upsert pipeline, folder layout, and how to add an integration now live in [integrations.md](integrations.md). leihbackend-specific code moved from `src/lib/server/leihbackend/` to `src/lib/server/integrations/leihbackend/`, and the trigger endpoint moved from `/api/sync/leihbackend` to `/api/sync`. The field mapping and sync algorithm described below remain accurate; treat references to old paths/routes as historical.

**Scope decisions (Matteo, 2026-06-10):**

1. Architecture covers Phase 1 (item sync) **and** Phase 2 (reservation forwarding); the work-package breakdown below covers **Phase 1 only**. Phase 2 gets its own breakdown when it starts.
2. **leihbackend is treated as fixed.** No changes to the leihbackend repo. The integration uses only its existing public API surface.
3. Sync is triggered by an **Uberspace crontab entry calling a secret-protected endpoint** in this app.
4. This spec lives in the repo; the vault holds a companion note with the strategic context.

---

## 1. The two systems

| | share-mvp (this repo) | leihbackend |
|---|---|---|
| Role | Public marketplace (allerleih.org) | Operational software of a physical lending library ("Leihladen") |
| Stack | SvelteKit 2 + PocketBase | PocketBase (pb_hooks, JS VM) |
| Instances | 1 | One per Leihladen. Currently: Commons Zentrum |
| Items | `items` collection, owned by users | `item` collection + public read-only view `item_public` |
| Users | Full accounts | No end-user accounts. Reservations identified by e-mail |

**Goal:** items of each configured leihbackend instance appear on the marketplace as items of an institutional account (Phase 1), and marketplace users can reserve them — the reservation is created in the leihbackend instance, which remains the source of truth (Phase 2).

## 2. leihbackend public API surface (verified, no auth required)

### 2.1 Item listing

```
GET {base}/api/collections/item_public/records?page={n}&perPage=200
```

Standard PocketBase list response (`page`, `perPage`, `totalItems`, `totalPages`, `items[]`). The view already excludes `status = "deleted"` and the staff-only `internal_note`/`highlight_color` fields. Record fields:

| Field | Type | Notes |
|---|---|---|
| `id` | string | PocketBase record id of the underlying `item`. Stable. Used for reservations and file URLs. |
| `iid` | number | Human-readable inventory number (printed on physical labels) |
| `name` | string | |
| `description` | string | **HTML** (PocketBase editor field) |
| `status` | string | `instock`, `outofstock`, `onbackorder`, `reserved`, `lost`, `repairing`, `forsale` |
| `deposit` | number | Kaution in EUR |
| `images` | string[] | File names; first one is the primary image |
| `synonyms` | string | Comma-separated search synonyms |
| `category` | string | Free text, instance-specific |
| `brand`, `model`, `packaging`, `manual` | string | |
| `parts`, `copies` | number | |
| `added_on` | datetime | |
| `is_protected` | bool | Bulky items; cannot be reserved via the public reservation flow (staff-managed `booking` instead) |

Important: leihbackend's own hooks keep `status` up to date when reservations/rentals are created or closed (a reserved item flips to `reserved`, a rented one to `outofstock`). So **`status` alone is a sufficient availability signal** — no need to fetch reservations/rentals/bookings and recompute availability locally.

### 2.2 Item images

```
{base}/api/files/item/{id}/{filename}
```

The `images` file field is not marked "protected" in PocketBase, so files are publicly served regardless of collection API rules. Use the `item` collection path (not `item_public`) — verified safe. Thumbnail variant: append `?thumb=300x300` (PocketBase built-in).

### 2.3 Opening hours (needed in Phase 2)

```
GET {base}/api/opening-hours
```

Returns the configured opening hours (falls back to defaults). Reservation pickup times must fall within these.

### 2.4 Reservation creation (Phase 2)

```
POST {base}/api/collections/reservation/records
Content-Type: application/json
{
  "customer_name": "...",
  "customer_phone": "...",
  "customer_email": "...",
  "items": ["<item record id>"],   // PocketBase ids, NOT iids
  "pickup": "2026-06-18 17:00:00"
}
```

Server-side validation in leihbackend (rejects with `BadRequestError`, German messages):

- every item must have `status = "instock"`
- no item may have `is_protected = true`
- `pickup` must be in the future and within opening hours

Side effects handled entirely by leihbackend: item statuses flip to `reserved`, a confirmation e-mail with a cancellation link (token-based, `GET {base}/api/reservation/cancel?token=…`) is sent to `customer_email`. For unauthenticated callers the create response hides most record fields (privacy) — do not rely on reading back reservation details from the response; verify during Phase 2 implementation what exactly is returned.

## 3. Architecture (both phases)

```
                         every 15 min (Uberspace cron)
  ┌────────────────┐   POST /api/sync/leihbackend    ┌─────────────────┐
  │ leihbackend CZ │ ◄──── GET item_public ───────── │    share-mvp    │
  └────────────────┘                                 │                 │
  ┌────────────────┐ ◄──── GET item_public ───────── │  upsert items   │
  │ leihbackend MQ │                                 │  on (owner,     │
  └────────────────┘ ◄──── POST reservation ──────── │   externalId)   │
                          (Phase 2, per user action) └─────────────────┘
```

- **Pull, not push:** share-mvp polls each configured instance; a leihbackend outage degrades freshness, never breaks the marketplace.
- **Institutional-item model:** each Leihladen is a `users` record with `isInstitution = true`; its items are regular `items` records with `externalId` set. This reuses the entire existing third-party pipeline (search view, badges, archive semantics from the CSV import at `src/routes/user/import/`).
- **leihbackend = source of truth** for items and (Phase 2) reservations. share-mvp stores copies (items) and pointers (reservations), never authoritative state.
- **Generic by construction:** configuration is per institution user (base URL field). Any external leihbackend operator can be onboarded by creating an institutional account and setting the URL — Starterkit-relevant.

### 3.1 Field mapping (leihbackend → share-mvp `items`)

| share-mvp field | Source | Rule |
|---|---|---|
| `externalId` | `id` | **The leihbackend record id**, not `iid`. Rationale: it is the key needed for Phase-2 reservation POSTs and file URLs; `iid` is surfaced in the description instead. (Deviation from the May architecture note, which left this open between `id` and `iid`.) |
| `name` | `name` | Trim; truncate to 200 chars |
| `description` | `description` + extras | Strip HTML to plain text (decode entities, collapse whitespace, preserve paragraph breaks). Append a structured block, omitting empty lines: `Inventarnummer: {iid}`, `Marke: {brand}`, `Modell: {model}`, `Teile: {parts}` (if > 1), `Kaution: {deposit} €` (if > 0). Truncate to 4000 chars |
| `status` | `status` + `is_protected` | `instock` → `available`; everything else → `unavailable`. `is_protected` does **not** affect Phase-1 status (protected items are lendable, just not online-reservable) |
| `categories` | `category` | Keyword mapping to `ITEM_CATEGORIES` (see §4 WP1); fallback `['Sonstiges']` |
| `externalImgUrl` | `images[0]` | `{base}/api/files/item/{id}/{images[0]}`; empty string if no images |
| `externalUrl` | per-institution template | `users.leihbackendItemUrlTemplate` with `{id}`/`{iid}` placeholders, if configured (e.g. a commonszentrum.de catalogue anchor). If empty: leave `externalUrl` empty → item uses the normal in-platform request flow (conversation with the institution account). See decision note in §6 |
| `place` | institution user | `user.city`, fallback empty |
| `owner` | — | The institution user's id |
| `trusteesOnly` | — | Always `false` |
| `image` | — | Never set (no file downloads; `externalImgUrl` is the existing mechanism for externally hosted images) |

Not mapped (intentionally dropped): `synonyms` (appended to description would pollute it; search hits on name/description suffice for the MVP), `packaging`, `manual`, `copies`, `added_on`.

### 3.2 Sync algorithm

Per configured institution (a `users` record with `isInstitution = true` and non-empty `leihbackendUrl`):

1. Page through `item_public` (`perPage=200`) until exhausted. Abort the **whole institution** on any HTTP/network error — partial data must never trigger archiving.
2. Map every record per §3.1.
3. Load existing items: `filter: owner = "{id}" && externalId != ""`, fields `id, externalId, name, description, status, categories, externalImgUrl, externalUrl, place`.
4. Diff: create missing, update changed (compare mapped fields; skip no-op writes), **archive** items whose `externalId` was not seen in step 1 — same semantics as the CSV import: `status = 'unavailable'` + description prefix `[Nicht mehr im Bestand] ` (reuse/extract that logic, see WP3).
5. Un-archive: if a previously archived item reappears in the feed, the normal update path overwrites status and description — strip the archive prefix when the source item is present again.
6. Write a summary log line per institution: `{institution, fetched, created, updated, archived, skipped, errors, durationMs}`.

Writes use a **PocketBase superuser client** (the sync runs unattended; institution-user impersonation would require storing their password). Batched via `pb.createBatch()` in chunks, mirroring `src/routes/user/import/+page.server.ts` (batch size 50, short pauses).

### 3.3 Phase 2 — reservation forwarding (architecture only, no work packages yet)

- **UI:** on the item detail page, if the owner has `leihbackendUrl` and the item is not protected and `status = available`: replace the conversation CTA with "Reservieren" → small form: pickup date + time slot (slots computed from `GET {base}/api/opening-hours`), optional phone number.
- **Server:** SvelteKit form action (repo convention; no REST layer) POSTs to the leihbackend reservation endpoint with `items: [externalId]`, `customer_name = username`, `customer_email = user.email`. leihbackend sends the confirmation + cancellation mail — share-mvp builds no mail logic.
- **State:** new collection `external_reservations` (`user`, `item`, `institution`, `pickup`, `createdAt`; superuser-only rules) purely as a pointer for a "Meine Reservierungen" view. Cancellation happens via the link in leihbackend's mail (MVP).
- **Conflict window:** within the ≤15-min sync lag an item can already be taken; leihbackend rejects the POST and the form surfaces a clear German error ("Der Gegenstand wurde gerade anderweitig reserviert."). No data inconsistency possible.
- **Protected items** (`is_protected`): keep the deep-link/contact CTA — they are never online-reservable.
- **GDPR:** forwarding the user's e-mail to a Leihladen operator makes that operator a separate data controller. Before Phase 2 ships: DSE update + (for third-party operators) an AVV/joint-controller mechanism, coupled to Starterkit onboarding. Flagged in the vault (Datenschutz-Risikoanalyse).
- **Carried-over verification items for Phase 2:** (a) exact shape of the unauthenticated reservation-create response; (b) whether `customer_phone` is schema-required in the target instances; (c) whether a `comments` field should carry "Reservierung über AllerLeih".

## 4. Phase 1 work packages (Claude Code)

Conventions that apply to every WP: TypeScript strict; Svelte 5 runes; all user-facing German strings go to `src/lib/texts.ts`; tests co-located with Vitest, PocketBase mocked via stubbed `pb.collection()` (see `docs/testing-strategy.md`); never destructure the `data` prop.

### WP0 — Manual prerequisites (Matteo, not Claude Code)

Schema changes happen in the PocketBase admin dashboard (no migrations in this repo):

1. `users` collection, new fields: `leihbackendUrl` (URL, optional, hidden from public API responses), `leihbackendItemUrlTemplate` (text, optional, hidden).
   - `leihbackendUrl` is the bare origin of the leihbackend instance — no trailing slash, no `/api`, no path. Example: `https://allerlei.uber.space`. Validity check: `{leihbackendUrl}/api/collections/item_public/records` must return items JSON (this also distinguishes a leihbackend instance from the marketplace PocketBase — only leihbackend has `item_public`).
   - `leihbackendItemUrlTemplate` is a **human-facing deep link**, never an API URL. Placeholders `{id}` and `{iid}`. Real example (CZ public reservation page, served on the same origin as the API but not part of the leihbackend repo): `https://allerlei.uber.space/reservierung/{iid}` — e.g. the drill with inventory number 48 lives at `https://allerlei.uber.space/reservierung/48`. Leave empty if no public catalogue page exists.
2. Create/confirm institutional accounts for CZ and Mosaique (`isInstitution = true`, `city` set) and fill `leihbackendUrl`.
3. New env vars on Uberspace + `.env.example`: `PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`, `SYNC_SECRET` (long random string).
4. Confirm the `items_public` view needs no change (it doesn't — all mapped fields already exist on `items`).

### WP1 — Pure mapping module

`src/lib/server/leihbackend/mapping.ts` + `mapping.test.ts`

- Types for the `item_public` record (`LeihbackendItem`).
- `stripHtml(html: string): string` — tag removal, entity decoding, paragraph preservation. No new dependency; if regex-based stripping gets hairy, prefer a tiny well-tested function over pulling in a sanitizer lib (input is trusted-ish: it comes from the partner instance, and output is rendered as plain text, not HTML).
- `mapCategory(category: string): string[]` — lowercase keyword table → `ITEM_CATEGORIES`, e.g. werkzeug/garten/bohr → 'Werkzeug und Garten'; küche/koch → 'Küche'; spiel (but not spielzeug-für-kinder terms) → 'Spiele'; kind/baby → 'Für Kinder'; sport/freizeit/fitness → 'Freizeit und Sport'; camping/outdoor/reise/zelt → 'Reisen und Outdoor'; elektro/computer → 'Elektronik'; musik/licht/ton/audio/beamer → 'Ton und Licht'; buch → 'Bücher'; fallback `['Sonstiges']`. Export the table as a constant for later per-instance overrides.
- `mapItem(src: LeihbackendItem, ctx: {baseUrl, ownerId, city, urlTemplate}): MappedItem` implementing §3.1 exactly, incl. truncation and the description block.
- Tests: HTML stripping (entities, nested tags, line breaks), every status value, category fallback, deposit/parts omission rules, URL-template substitution, truncation.

### WP2 — leihbackend API client

`src/lib/server/leihbackend/client.ts` + `client.test.ts`

- `fetchAllItems(baseUrl: string, fetchFn = fetch): Promise<LeihbackendItem[]>` — paginates `perPage=200`, hard cap 5 000 items (mirrors import limits), 15 s timeout per request via `AbortSignal.timeout`, throws a typed `LeihbackendFetchError` on any non-2xx/network failure (the caller must treat the institution's pull as failed — no partial results).
- Normalize `baseUrl` (strip trailing slash, require `https://` outside dev).
- Tests with a mocked `fetchFn`: pagination across pages, timeout, non-2xx, cap exceeded.

### WP3 — Sync engine

`src/lib/server/leihbackend/sync.ts` + `sync.test.ts`

- `getSuperuserClient()`: `new PocketBase(PUBLIC_PB_URL)` + `collection('_superusers').authWithPassword(env)`; cache the client at module level, re-auth on 401.
- `syncInstitution(pb, institution): Promise<SyncSummary>` implementing §3.2: fetch (WP2) → map (WP1) → diff → batched create/update/archive. **Extract the archive logic** (`'[Nicht mehr im Bestand] '` prefixing + status flip) from `src/routes/user/import/+page.server.ts` into a shared helper in `src/lib/server/leihbackend/` or `src/lib/server/itemArchive.ts` and refactor the import to use it (behavior-identical; the import's existing tests must stay green).
- `syncAll(pb): Promise<SyncSummary[]>` — find institutions (`isInstitution = true && leihbackendUrl != ""`), run sequentially, isolate failures per institution.
- Tests: create/update/archive/un-archive paths, no-op detection (no write when nothing changed), fetch failure ⇒ zero writes for that institution, one institution's failure doesn't block the next.

### WP4 — Trigger endpoint

`src/routes/api/sync/leihbackend/+server.ts` + test

- `POST`, requires header `Authorization: Bearer {SYNC_SECRET}`; constant-time comparison; 401 otherwise; 503 with a clear message if env vars are missing.
- Runs `syncAll`, returns the JSON summary, logs one line per institution via `console.log`/`console.error` (supervisord captures stdout).
- Add `/api/sync` to `unprotectedPrefix` in `src/hooks.server.ts` (the endpoint protects itself; without this the auth hook would redirect the cron's request to /auth/login).

### WP5 — UX for synced items

- Verify synced items render correctly on `/search` and `/items/[id]` through the existing institutional paths (`items_public` view, institution badge, `externalImgUrl` display).
- Item detail: `isExternal` is currently `!!item.externalUrl`. With an empty `externalUrl`, synced items get the normal conversation request flow — acceptable for CZ/Mosaique (accounts are monitored). If the institution has `leihbackendItemUrlTemplate` set, the deep-link CTA appears automatically. **One addition:** for available synced items reached via the conversation flow, no change; for `status = 'unknown'` nothing applies (synced items are never `unknown`). Check that nothing in the CTA logic breaks when `externalImgUrl` is set but `externalUrl` is empty.
- New strings, if any, to `texts.ts` under `institutional`.

### WP6 — Docs & ops

- `docs/architecture.md`: add the sync to "External API Boundaries" (leihbackend joins ORS/Mistral) and document the endpoint.
- `docs/data-model.md`: new `users` fields.
- `docs/operations/`: new runbook `leihbackend-sync.md` — env vars, manual trigger (`curl -fsS -X POST -H "Authorization: Bearer $SYNC_SECRET" https://www.allerleih.org/api/sync/leihbackend`), crontab line (`*/15 * * * * curl -fsS -X POST -H "Authorization: Bearer $SYNC_SECRET" https://www.allerleih.org/api/sync/leihbackend >> ~/logs/leihbackend-sync.log 2>&1`), failure modes (leihbackend down ⇒ stale-but-present items; superuser auth failure ⇒ 503).
- `.env.example`: new vars.

### WP7 — Verification (manual, with Matteo)

1. `npm run check && npm run lint && npm run test` green.
2. Trigger sync against the live CZ instance in a staging/dev environment; inspect created items (image, description block, category, status).
3. Flip an item to `reserved` in the CZ leihbackend admin → re-trigger → marketplace item becomes `unavailable`.
4. Delete/soft-delete an item in CZ → re-trigger → marketplace item archived with prefix.
5. Stop the leihbackend instance → trigger → summary reports failure, **zero** items archived.
6. Install crontab entry; confirm two consecutive automatic runs in the log.

Suggested PR slicing: PR 1 = WP1+WP2 (pure, no schema deps), PR 2 = WP3+WP4 (needs WP0 done), PR 3 = WP5+WP6.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Schema drift in leihbackend (`item_public` view changes) | All leihbackend knowledge is isolated in `src/lib/server/leihbackend/`; mapping tests double as a contract. Pin expectations to the view fields listed in §2.1 |
| Double-reservation in the sync window (Phase 2) | leihbackend rejects; surface error; no inconsistency |
| Superuser credentials in env | Same trust level as existing VAPID/API secrets on Uberspace; scoped alternative (impersonation tokens) can replace it later without architectural change |
| Conversation requests to unmonitored institution accounts | CZ/Mosaique are monitored by the team; for external operators (Starterkit), require either `leihbackendItemUrlTemplate` or Phase-2 reservations before onboarding |
| `iid` collisions after a leihbackend reinstall | Avoided: `externalId` is the PB record id, which changes on reinstall ⇒ old items archive, new ones created. Correct behavior |

## 6. Decisions made in this spec (transparent, revisitable)

1. `externalId = leihbackend record id` (not `iid`) — needed for Phase 2; `iid` lives in the description. _Deviation from the May note's `iid` lean._
2. No leihbackend availability endpoint — `item_public.status` already encodes availability ("Weg b" from the May note turned out to be trivial since leihbackend maintains `status` itself; the consolidated endpoint ("Weg a") is unnecessary, which also satisfies the "leihbackend fixed" constraint).
3. `synonyms` are not imported.
4. Items without a configured URL template fall back to the normal in-platform request flow rather than a dead-end CTA.
5. Protected items are shown as `available` in Phase 1 (they are lendable on site), and excluded from online reservation in Phase 2.
