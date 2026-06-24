# Data Model

Here live the ER schemas as implemented in the database for the current branch.

# Main Schema

```mermaid
---
title: PocketBase Schema
---
erDiagram
    direction LR

    USER{
        string id PK
        string username
        string email
        string city
        bool verified
        bool isInstitution
        string profileImage
        string bio
        string preferredTransportMode "foot|bicycle|car"
        bool hasOnboarded
        string inviteCode
        string invitedBy FK
        User[] trusts FK
        date created
        date updated
    }

    USER 1 to zero or more USER: "trusts"

    USER_GEOLOCATION{
        string id PK
        User user FK "owner only — unique"
        json geolocation "GeoPoint lat/lon"
    }

    USER 1 to zero or one USER_GEOLOCATION: "location (private)"

    USER_CONTACT{
        string id PK
        User user FK "owner only — unique"
        string telegramUsername
        string signalLink
        bool telegramVisibleToTrustedOnly
        bool signalVisibleToTrustedOnly
    }

    USER 1 to zero or one USER_CONTACT: "contact handles (private)"

    ITEM{
        string id PK
        string name
        string image "filename in PocketBase Files"
        string externalImgUrl "for imported items"
        string description
        string place
        User owner FK
        bool trusteesOnly
        string[] categories
        string status "available|unavailable|unknown"
        string externalId "partner system upsert key"
        string externalUrl "deep-link to partner system"
        date created
        date updated
    }

    USER 1 to zero or more ITEM: owns

    CONVERSATION{
        string id PK
        User requester FK
        User itemOwner FK
        Item requestedItem FK
        Message[] messages
        bool readByRequester
        bool readByOwner
        string lendingStatus "pending|accepted|rejected|active|return_requested|completed"
        json counterfactual "impact research answer"
        date created
        date updated
    }

    USER 1 to zero or more CONVERSATION: has
    CONVERSATION zero or more to 1 ITEM: concerns

    MESSAGE{
        string id PK
        string messageContent
        User from FK
        User to FK
        date created
        date updated
    }

    CONVERSATION 1 to zero or more MESSAGE: contains

    NOTIFICATION{
        string id PK
        User recipient FK
        User sender FK "optional"
        string type "new_message|new_request|trust_added|invite_accepted|request_accepted|request_rejected|handover_confirmed|return_requested|return_confirmed"
        string relatedId "conversation or user ID"
        string body "pre-formatted German text"
        bool read
        date created
        date updated
    }

    USER 1 to zero or more NOTIFICATION: receives

    PUSH_SUBSCRIPTION{
        string id PK
        User user FK
        string endpoint
        string p256dh
        string auth
        date created
        date updated
    }

    USER 1 to zero or more PUSH_SUBSCRIPTION: registers

    FEEDBACK{
        string id PK
        string feedbackMessage
        string route
        string device
        string viewportSize
        string browser
        string browserVersion
        date created
        date updated
    }

    LENDING_TERMS{
        string id PK
        User owner FK "institution user"
        string version
        string title
        string body "HTML content"
        date effectiveFrom
        bool active "only one active per owner"
        int minAge
        date created
        date updated
    }

    USER 1 to zero or more LENDING_TERMS: publishes

    TERM_ACCEPTANCE{
        string id PK
        User user FK
        LendingTerms terms FK
        date acceptedAt
        bool confirmedAdult
        string fullNameSnapshot
        string termsBody "HTML snapshot at time of acceptance"
        string termsVersion
        string termsTitle
        string userIp
        string userAgent
        date created
        date updated
    }

    USER 1 to zero or more TERM_ACCEPTANCE: accepts
    LENDING_TERMS 1 to zero or more TERM_ACCEPTANCE: recorded in

    OUTBOUND_CLICK{
        string id PK
        string destination
        string source_page
        Item item FK "optional"
        date created
        date updated
    }

    ITEM 1 to zero or more OUTBOUND_CLICK: tracked by
```

## user_geolocations

Coordinates are **not** stored on `users` — they live in a separate `user_geolocations` collection so they can be locked to the owner. All API rules (`listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule`) are `@request.auth.id = user`, so a user can only ever read/write **their own** row; no account can query another user's coordinates. The `users` collection no longer has a `geolocation` field at all. Travel-time computation reads coordinates with backend privileges via the `/api/travel-times` hook (see below).

## user_contacts

Messenger handles (`telegramUsername`, `signalLink`) and their per-handle "visible to trusted only" flags live here, **not** on `users`. All API rules are `@request.auth.id = user` (owner-only). They reach other users only through the `GET /api/contact/{userId}` hook, which returns a handle to a caller only if it's public (flag off), the caller is the owner, or the owner trusts the caller — so the "trusted only" toggle is enforced at the data layer, not just in the UI.

## items_public and items_searchable Views

Two read-only PocketBase SQL views expose `items` joined with `users` (and `user_geolocations` for the location flag) as flat, privacy-safe rows. Neither exposes the owner's `trusts` list, and neither includes raw coordinates — they expose only `ownerHasLocation` (0 or 1); travel times are computed in the backend `/api/travel-times` hook, which returns only **bucketed minutes** so coordinates never reach the client.

### `items_public` — public, content-masked

Fully public (`listRule`/`viewRule` are open). For **trustees-only** items the content columns (`name`, `image`, `externalImgUrl`, `externalUrl`, `description`) are masked to `NULL`; only metadata (`categories`, `status`, owner, `trusteesOnly`) stays visible — so the *existence* of a trustees-only item can be shown without leaking its details. The profile and item-detail pages read from this view and, for the owner and trusted viewers, fetch the unmasked details from the base `items` collection (trust rule below).

### `items_searchable` — trust-filtered, unmasked

Used by the search page. Its row-level rule
`trusteesOnly = false || (@request.auth.id != "" && (@request.auth.id = userId || userId.trusts.id ?= @request.auth.id))`
returns public items to everyone, and trustees-only items only to the owner and to users the owner trusts. Content is **not** masked here, because rows a viewer may not see are filtered out entirely. The owner's `trusts` list is only traversed inside the rule, never returned as a column.

| Field | Source | Notes |
|---|---|---|
| id, name, image, externalImgUrl, externalUrl, description, trusteesOnly, status, categories, updated | items | Direct columns (masked to `NULL` for trustees-only items in `items_public`) |
| userId, username, isInstitution, bio, verified, profileImage, userCreated | users | Joined from owner (`trusts` is **not** exposed) |
| ownerHasLocation | SQL expression on `user_geolocations` | 1 if the owner has a non-(0,0) location, else 0 |

> **A view returns only the columns in its `viewQuery` SELECT — nothing else.** The TS
> `ItemPublic` type extends `PocketBaseEntity`, so it *declares* `id`, `created` and `updated`,
> but only the columns above are actually populated. When you need a new column, update the `viewQuery` in `allerleih-backend`
> first; see that repo's README ("Writing migrations").

### Base `items` trust rule

The base `items` collection's `listRule`/`viewRule` are
`@request.auth.id != "" && (trusteesOnly = false || @request.auth.id = owner || owner.trusts.id ?= @request.auth.id)`,
so a trustees-only item's full record is readable only by the owner and trusted users. The profile and item-detail pages use this to un-mask details for trusted viewers.

## Impact Research: `counterfactual`

`conversations.counterfactual` is populated at loan completion for a random ~33% of loans. It records the borrower's answer to a survey asking what they would have done without the platform (e.g., bought it new, borrowed elsewhere, gone without). This data is used to measure the platform's environmental and social impact.
