// Platform legal documents (ToS & privacy statement) — Issue #399.
//
// The document text and the current version of each document are NOT hard-coded
// here any more: they live in the `legal_documents` PocketBase collection so a
// platform operator can edit them in the admin UI without a code change (AllerLeih
// is meant to be self-hostable). Read them server-side via
// `$lib/server/legalDocs` (`getActiveLegalDocs` / `getActiveLegalVersions`); the
// consent helpers in `$lib/server/legal` compare a user's accepted version against
// the active one. This module only carries the shared type.

export type LegalDocType = 'tos' | 'privacy';
