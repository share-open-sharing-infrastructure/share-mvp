# Onboarding an Institutional Partner

Short checklist for bringing a new institution onto AllerLeih.

## Steps

1. **Create the account** — sign up at `/auth/register` using the institution's official email address. Choose a `username` matching the institution's display name (e.g. `RatsbüchereiLüneburg`).

2. **Set `isInstitution = true`** — in the PocketBase admin dashboard, open the `users` collection, find the new record, and toggle `isInstitution` to `true`. This cannot be done from the UI.

3. **Set `profileImage` and `bio`** — either upload a logo as `profileImage` directly in the PocketBase admin, or have the institution do it after step 4. Write a starter `bio` covering address, opening hours, website, and lending modalities.

4. **Hand over the account** — send a password-reset link to the institution's contact person via `/auth/reset` so they can set their own password and take ownership of the account.

5. **Institution configures inventory** — the contact person logs in, refines `bio` and `profileImage` from `/user/profile`, then goes to `/user/import` to download the CSV template and upload their inventory. (If the institution runs supported lending software, set up an automatic integration instead — see below.)

## Connecting an automatic integration

If the institution runs lending software AllerLeih supports, its catalogue can be kept in sync automatically instead of (or in addition to) manual CSV uploads. Configuration is a couple of fields on the institution's `users` record in the PocketBase admin dashboard. See [integration-sync.md](integration-sync.md) for how the sync runs operationally and [../integrations.md](../integrations.md) for the architecture.

> **Heads-up — one shared field for now:** the base URL for *every* integration type currently goes into the `leihbackendUrl` field (it's overloaded as a generic base URL until a dedicated `sync_config` collection exists). Paste the appropriate URL below into `leihbackendUrl` regardless of the software.

### leihbackend (Leihladen software)

| Field | Value |
|---|---|
| `leihbackendUrl` | The bare instance origin — no trailing slash, no `/api`, no path. Example: `https://allerlei.uber.space`. |
| `leihbackendItemUrlTemplate` *(optional)* | Human-facing deep-link template with `{id}`/`{iid}` placeholders, e.g. `https://allerlei.uber.space/reservierung/{iid}`. Leave empty if there's no public catalogue page. |

**Validity check:** `{leihbackendUrl}/api/collections/item_public/records` should return items JSON. (This is also what distinguishes a leihbackend instance — only leihbackend exposes `item_public`.)

Items are pulled by the **full sync** (`POST /api/sync`), driven by cron. No manual CSV upload is needed.

### WINBIAP (library catalogue software)

| Field | Value |
|---|---|
| `leihbackendUrl` | The institution's **WebOPAC base URL**, e.g. `https://rblg.stadt.lueneburg.de/webopac`. |
| `leihbackendItemUrlTemplate` *(optional)* | Deep-link template to the public catalogue record, if one exists. |

WINBIAP has no bulk feed, so the lifecycle is two-step:

1. **Initial import:** the institution uploads its catalogue once via the CSV import at `/user/import` (this is what sets each item's `externalId` and `externalUrl`).
2. **Keeping fresh:** the **per-item refresh** (`POST /api/refresh`) re-checks each stored item against the WebOPAC on a cron, updating changed items and archiving ones that disappear.

> Do **not** rely on `POST /api/sync` for a WINBIAP institution — it will try (and fail) to fetch `item_public`. The failure is isolated and harmless, but WINBIAP institutions are kept current by `/api/refresh`, not the full sync.

## Notes

- `isInstitution` can only be toggled by an admin via the PocketBase dashboard. The user UI has no control over this field.
- Items with a non-empty `externalUrl` show a deep-link CTA on the detail page instead of the AllerLeih request flow. Make sure this is the intended behaviour before publishing items with `externalUrl` set.
- If the institution's external system (e.g. WinBIAP) does not yet have a confirmed permalink format, leave `externalUrl` empty in the CSV. Items will then use the normal AllerLeih request flow until the URL format is confirmed and the CSV is re-imported.
- To offboard an institution, set `isInstitution = false` in the admin dashboard **after** removing `externalUrl` from all of their items. Then archive or reassign items as appropriate.
