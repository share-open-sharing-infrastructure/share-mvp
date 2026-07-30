# Onboarding an Institutional Partner

Short checklist for bringing a new institution onto AllerLeih.

## Steps

1. **Create the account** — sign up at `/auth/register` using the institution's official email address. Choose a `username` matching the institution's display name; spaces are allowed, up to 50 characters (e.g. `Ratsbücherei Lüneburg`). Login is always via the email address, not the username.

2. **Set `isInstitution = true`** — in the PocketBase admin dashboard, open the `users` collection, find the new record, and toggle `isInstitution` to `true`. This cannot be done from the UI.

3. **Set `profileImage` and `bio`** — either upload a logo as `profileImage` directly in the PocketBase admin, or have the institution do it after step 4. Write a starter `bio` covering address, opening hours, website, and lending modalities.

4. **Hand over the account** — send a password-reset link to the institution's contact person via `/auth/reset` so they can set their own password and take ownership of the account.

5. **Institution configures inventory** — the contact person logs in, refines `bio` and `profileImage` from `/user/profile`, then goes to `/user/import` to download the CSV template and upload their inventory. (If the institution runs supported lending software, set up an automatic integration instead — see below.)

## Connecting an automatic integration

If the institution runs lending software AllerLeih supports, its catalogue can be kept in sync automatically instead of (or in addition to) manual CSV uploads. Configuration is a **`sync_config`** row in the PocketBase admin dashboard — the single source of truth for integration discovery. See [integration-sync.md](integration-sync.md) for how the sync runs operationally and [../integrations.md](../integrations.md) for the architecture.

Open the `sync_config` collection → *New record*:

| Field | Value |
|---|---|
| `institution` | The institution's `users` record. |
| `integration` | `leihbackend` **or** `winbiap`. |
| `baseUrl` | **leihbackend:** the bare instance origin — no trailing slash, no `/api`, no path (e.g. `https://allerlei.uber.space`). **WINBIAP:** the WebOPAC base (e.g. `https://rblg.stadt.lueneburg.de/webopac`). |
| `itemUrlTemplate` *(optional)* | Human-facing deep-link template with `{id}`/`{iid}` placeholders, e.g. `https://allerlei.uber.space/reservierung/{iid}`. Leave empty if there's no public catalogue page. |
| `enabled` | `true` (set `false` to pause the backend cron for this institution). |

### leihbackend (Leihladen software)

Set `integration = leihbackend`. **Validity check:** `{baseUrl}/api/collections/item_public/records` should return items JSON — only leihbackend exposes `item_public`. Items are pulled automatically by the **full sync** (`integration_sync` cron); no manual CSV upload is needed.

### WINBIAP (library catalogue software)

Set `integration = winbiap`. WINBIAP has no bulk feed, so the lifecycle is two-step:

1. **Initial import:** the institution uploads its catalogue once via the CSV import at `/user/import` (this sets each item's `externalId` and `externalUrl`).
2. **Keeping fresh:** the **per-item refresh** (`integration_refresh` cron, or the on-demand "Alle Gegenstände synchronisieren" button on `/user/import`) re-checks each stored item against the WebOPAC, updating changed items and archiving ones that disappear.

The full sync only pulls `leihbackend` configs, so a WINBIAP institution is never touched by it.

## Notes

- The CSV import and both cron jobs write in the backend via PocketBase transactions (`$app.runInTransaction`) — no Batch API needed.
- `isInstitution` can only be toggled by an admin via the PocketBase dashboard. The user UI has no control over this field.
- Items with a non-empty `externalUrl` show a deep-link CTA on the detail page instead of the AllerLeih request flow. Make sure this is the intended behaviour before publishing items with `externalUrl` set.
- If the institution's external system (e.g. WinBIAP) does not yet have a confirmed permalink format, leave `externalUrl` empty in the CSV. Items will then use the normal AllerLeih request flow until the URL format is confirmed and the CSV is re-imported.
- To offboard an institution, set `isInstitution = false` in the admin dashboard **after** removing `externalUrl` from all of their items. Then archive or reassign items as appropriate.
