# Updating the Legal Documents (ToS / Privacy)

The platform's Terms of Service and privacy statement live in the **`legal_documents`**
PocketBase collection (Issue #399), so an operator can change them from the admin dashboard —
no code change or deploy. Each document type (`tos`, `privacy`) has exactly one `active` row;
that row is what users see and consent to.

## Where

PocketBase admin → collection **`legal_documents`**. Fields: `docType` (`tos` | `privacy`),
`version`, `title`, `effectiveDate`, `body` (rich-text/HTML), `active`.

## Case A — small correction (no re-consent)

A typo fix or clarification that does **not** require users to consent again:

1. Open the active row for the document, edit `body`, save. Leave `version` unchanged.

Existing users are **not** re-prompted. Note: already-stored consent snapshots
(`user_legal_acceptances.bodySnapshot`) are immutable and keep the old text — only future
consents capture the corrected text.

## Case B — material change (everyone must re-consent)

A change that requires renewed consent. Because a partial unique index allows only **one active
row per `docType`**, mind the order:

1. Open the current active row → set `active = false` → save.
2. Create a new row: `docType` (e.g. `tos`), a higher `version` (e.g. `1.4`), `title`,
   `effectiveDate` (e.g. today), the new `body`, and `active = true` → save.

Within ~60 s (the server caches active versions briefly) the consent gate compares each user's
accepted version against the new active one and redirects anyone who is behind to
`/legal/accept`, where they must accept before using the app again.

## Notes

- **ToS and privacy are independent.** Bump only the document you changed; users won't be asked
  to re-confirm the unchanged one.
- **`version` is a free string** — it only has to differ from what users have accepted
  (`1.4`, `2.0`, `2026-07-01`, …).
- **`body` is HTML.** The admin editor formats visually; if you paste raw HTML use simple
  semantic tags (`<h2>`, `<p>`, `<ul><li>`, `<strong>`, `<a>`, `<br/>`) — styling is applied
  automatically via the `.legal-prose` class. Do **not** add CSS classes in the body.
- **Don't edit consent state by hand.** `users.tosAcceptedVersion` / `privacyAcceptedVersion` /
  `legalLocked` and the `user_legal_acceptances` rows are server-managed; the accept/decline
  flow and the `legal.pb.js` hooks are the only intended writers. (To unblock a `legalLocked`
  user manually you *can* clear `legalLocked` in the admin, but normally they self-recover by
  accepting on `/legal/locked` → `/legal/accept`.)
- Inactive/old rows can stay as history.
