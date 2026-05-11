# Onboarding an Institutional Partner

Short checklist for bringing a new institution onto AllerLeih.

## Prerequisites

The PocketBase schema migration in `docs/migrations/2026-05-institutional-partners.md` must be applied before onboarding the first institution.

## Steps

1. **Create the account** — sign up at `/auth/register` using the institution's official email address. Choose a `username` matching the institution's display name (e.g. `RatsbüchereiLüneburg`).

2. **Set `isInstitution = true`** — in the PocketBase admin dashboard, open the `users` collection, find the new record, and toggle `isInstitution` to `true`. This cannot be done from the UI.

3. **Set `profileImage` and `bio`** — either upload a logo as `profileImage` directly in the PocketBase admin, or have the institution do it after step 4. Write a starter `bio` covering address, opening hours, website, and lending modalities.

4. **Hand over the account** — send a password-reset link to the institution's contact person via `/auth/reset` so they can set their own password and take ownership of the account.

5. **Institution configures inventory** — the contact person logs in, refines `bio` and `profileImage` from `/user/profile`, then goes to `/user/import` to download the CSV template and upload their inventory.

## Notes

- `isInstitution` can only be toggled by an admin via the PocketBase dashboard. The user UI has no control over this field.
- Items with a non-empty `externalUrl` show a deep-link CTA on the detail page instead of the AllerLeih request flow. Make sure this is the intended behaviour before publishing items with `externalUrl` set.
- If the institution's external system (e.g. WinBIAP) does not yet have a confirmed permalink format, leave `externalUrl` empty in the CSV. Items will then use the normal AllerLeih request flow until the URL format is confirmed and the CSV is re-imported.
- To offboard an institution, set `isInstitution = false` in the admin dashboard **after** removing `externalUrl` from all of their items. Then archive or reassign items as appropriate.
