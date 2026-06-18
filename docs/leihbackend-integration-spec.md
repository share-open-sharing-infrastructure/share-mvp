# leihbackend Integration — Reference & Phase 2 Plan

_Created: 2026-06-10 · Phase 1 (item sync): **shipped** · Phase 2 (reservation forwarding): **planned, not built** · Architecture decision record: see vault note "Integration leihbackend in AllerLeih-Plattform" (2026-05-11)_

This document is the leihbackend-specific reference for the AllerLeih integration. Phase 1 (item sync) is implemented; this file is kept for two reasons:

1. **External-system reference** — the verified leihbackend public API surface (§2), including the reservation and opening-hours endpoints needed for Phase 2.
2. **Phase 2 plan** — the reservation-forwarding architecture (§3.3) that has not yet been built.

> **Where the implementation lives now:** the sync machinery was generalized into a pluggable integration system shared with other sources (e.g. WINBIAP). The generic pipeline, folder layout, and "how to add an integration" guide are in [integrations.md](integrations.md); operations (endpoints, cron, env) are in [operations/integration-sync.md](operations/integration-sync.md). leihbackend code lives in `src/lib/server/integrations/leihbackend/`; the trigger endpoint is `POST /api/sync`. The field mapping (§3.1) and sync contract (§3.2) below remain accurate and double as the leihbackend mapping contract; the original Phase-1 work-package breakdown has been removed now that it is shipped.

**Scope decisions (Matteo, 2026-06-10):**

1. Architecture covers Phase 1 (item sync) **and** Phase 2 (reservation forwarding); the work-package breakdown below covers **Phase 1 only**. Phase 2 gets its own breakdown when it starts.
2. **leihbackend is treated as fixed.** No changes to the leihbackend repo. The integration uses only its existing public API surface.
3. Sync is triggered by an **cronjob calling a secret-protected endpoint** in this app.
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
                         every 15 min (cron)
  ┌────────────────┐   POST /api/sync                ┌─────────────────┐
  │ leihbackend CZ │ ◄──── GET item_public ───────── │    share-mvp    │
  └────────────────┘                                 │                 │
  ┌────────────────┐ ◄──── GET item_public ───────── │  upsert items   │
  │ leihbackend ... │                                 │  on (owner,     │
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
4. Diff: create missing, update changed (compare mapped fields; skip no-op writes), **archive** items whose `externalId` was not seen in step 1 — `status = 'unavailable'` + description prefix `[Nicht mehr im Bestand] ` (shared with the CSV import via `$lib/server/itemArchive`).
5. Un-archive: if a previously archived item reappears in the feed, the normal update path overwrites status and description — strip the archive prefix when the source item is present again.
6. Write a summary log line per institution: `{institution, fetched, created, updated, archived, skipped, errors, durationMs}`.

Writes use a **PocketBase superuser client** (the sync runs unattended; institution-user impersonation would require storing their password). Batched via `pb.createBatch()` in chunks, mirroring `src/routes/user/import/+page.server.ts` (batch size 50, short pauses).

### 3.3 Phase 2 — reservation forwarding (architecture only, no work packages yet)
**NEEDS REWORK - MIGHT REQUIRE A CART/CHECKOUT PROCESS TO WORK IDEALLY**

- **UI:** on the item detail page, if the owner has `leihbackendUrl` and the item is not protected and `status = available`: replace the conversation CTA with "Reservieren" → small form: pickup date + time slot (slots computed from `GET {base}/api/opening-hours`), optional phone number.
- **Server:** SvelteKit form action (repo convention; no REST layer) POSTs to the leihbackend reservation endpoint with `items: [externalId]`, `customer_name = username`, `customer_email = user.email`. leihbackend sends the confirmation + cancellation mail — share-mvp builds no mail logic.
- **State:** new collection `external_reservations` (`user`, `item`, `institution`, `pickup`, `createdAt`; superuser-only rules) purely as a pointer for a "Meine Reservierungen" view. Cancellation happens via the link in leihbackend's mail (MVP).
- **Conflict window:** within the ≤15-min sync lag an item can already be taken; leihbackend rejects the POST and the form surfaces a clear German error ("Der Gegenstand wurde gerade anderweitig reserviert."). No data inconsistency possible.
- **Protected items** (`is_protected`): keep the deep-link/contact CTA — they are never online-reservable.
- **GDPR:** forwarding the user's e-mail to a Leihladen operator makes that operator a separate data controller. Before Phase 2 ships: DSE update + (for third-party operators) an AVV/joint-controller mechanism, coupled to Starterkit onboarding. Flagged in the vault (Datenschutz-Risikoanalyse).
- **Carried-over verification items for Phase 2:** (a) exact shape of the unauthenticated reservation-create response; (b) whether `customer_phone` is schema-required in the target instances; (c) whether a `comments` field should carry "Reservierung über AllerLeih".

## 4. Phase 1 — implementation status

Phase 1 shipped. The detailed work-package breakdown that used to live here has been removed; the code and the generic docs are now the source of truth:

- **Code:** `src/lib/server/integrations/leihbackend/` (`client.ts`, `mapping.ts`, `index.ts`), built on the shared core in `src/lib/server/integrations/core/`.
- **Architecture & how to add an integration:** [integrations.md](integrations.md).
- **Operations** (endpoints, env vars, cron, failure modes): [operations/integration-sync.md](operations/integration-sync.md).
- **Onboarding** (which URLs go on the `users` record): [operations/onboarding-institutional-partner.md](operations/onboarding-institutional-partner.md).
- **Schema:** the `users` fields `leihbackendUrl` / `leihbackendItemUrlTemplate` are documented in [data-model.md](data-model.md). `leihbackendUrl` is the bare instance origin (validity check: `{leihbackendUrl}/api/collections/item_public/records` returns items JSON — only leihbackend exposes `item_public`).

## 5. Risks

| Risk | Mitigation |
|---|---|
| Schema drift in leihbackend (`item_public` view changes) | All leihbackend knowledge is isolated in `src/lib/server/integrations/leihbackend/`; mapping tests double as a contract. Pin expectations to the view fields listed in §2.1 |
| Double-reservation in the sync window (Phase 2) | leihbackend rejects; surface error; no inconsistency |
| Superuser credentials in env | Same trust level as existing VAPID/API secrets on prod; scoped alternative (impersonation tokens) can replace it later without architectural change |
| Conversation requests to unmonitored institution accounts | CZ is monitored by the team; for external operators (Starterkit), require either `leihbackendItemUrlTemplate` or Phase-2 reservations before onboarding |
| `iid` collisions after a leihbackend reinstall | Avoided: `externalId` is the PB record id, which changes on reinstall ⇒ old items archive, new ones created. Correct behavior |

## 6. Decisions made in this spec (transparent, revisitable)

1. `externalId = leihbackend record id` (not `iid`) — needed for Phase 2; `iid` lives in the description. _Deviation from the May note's `iid` lean._
2. No leihbackend availability endpoint — `item_public.status` already encodes availability ("Weg b" from the May note turned out to be trivial since leihbackend maintains `status` itself; the consolidated endpoint ("Weg a") is unnecessary, which also satisfies the "leihbackend fixed" constraint).
3. `synonyms` are not imported.
4. Items without a configured URL template fall back to the normal in-platform request flow rather than a dead-end CTA.
5. Protected items are shown as `available` in Phase 1 (they are lendable on site), and excluded from online reservation in Phase 2.
