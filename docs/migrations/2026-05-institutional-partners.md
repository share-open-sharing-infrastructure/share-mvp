# PocketBase Migration: Institutional Partners

Apply these changes manually in the PocketBase admin dashboard.

## 1. `users` collection — new fields

| Field name | Type | Settings |
|---|---|---|
| `isInstitution` | bool | Default: `false` |
| `profileImage` | file (single) | Max size: 2 MB; allowed MIME: `image/*` |
| `bio` | text | Multi-line: yes |

## 2. `items` collection — new fields and field changes

| Field name | Type | Settings |
|---|---|---|
| `externalId` | text | Add a single-field index |
| `externalUrl` | url | — |

**Extend the `status` select field** to include `unknown` as a third valid option alongside `available` and `unavailable`.

**Make the `image` field not required.** The existing `image` field was created as Required, which blocks CSV imports where no image is supplied. Open the `image` field settings and uncheck "Required".

## 3. Composite unique index on `items`

Create a unique index on the `items` collection for the combination `(owner, externalId)` where `externalId` is not empty. PocketBase does not natively support partial (filtered) unique indexes via the UI — enforce this in the import handler instead (the server-side CSV import already checks for duplicate `externalId` per owner before writing).

## 4. API rules

### `users` collection — Update rule

Restrict so that normal users cannot set `isInstitution` on themselves. Apply the following update rule:

```
@request.auth.id = id && @request.data.isInstitution:isset = false
```

This allows a user to update their own record as long as they are not attempting to change `isInstitution`. Admin requests bypass collection rules.

### `items` collection — Create and Update rules

Ensure `externalUrl` can only be set by institutional users:

```
@request.auth.id = owner && (@request.data.externalUrl = "" || @request.auth.isInstitution = true)
```

Apply this rule to both **Create** and **Update** operations on `items`.

## 5. Checklist

- [ ] Add `isInstitution` (bool, default false) to `users`
- [ ] Add `profileImage` (file, single, max 2 MB) to `users`
- [ ] Add `bio` (text, multi-line) to `users`
- [ ] Add `externalId` (text, indexed) to `items`
- [ ] Add `externalUrl` (url) to `items`
- [ ] Add `unknown` as a valid value to the `items.status` select field
- [ ] **Make `items.image` not required** (uncheck "Required" on the image field)
- [ ] Apply the `users` update API rule (block `isInstitution` self-edit)
- [ ] Apply the `items` create/update API rule (block `externalUrl` for non-institutions)
