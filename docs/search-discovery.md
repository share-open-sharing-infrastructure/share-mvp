# Search & Discovery (`/search`)

How the `/search` route turns URL parameters into a filtered, paginated, trust-safe list of
items. This is the app's main discovery surface and its default landing view once authenticated.

## Flow at a glance

```
URL search params
   │  parseSearchParameters()        searchFilter.ts
   ▼
SearchParameters  ──buildItemFilter()──►  PocketBase filter string
   │                                          │
   ▼                                          ▼
+page.server.ts load()  ──getList(page, perPage, { sort, filter })──►  items_searchable view
   │
   ▼
+page.svelte  ──►  ResultsList → ItemCard      (+ Pagination, CategoryFilter, TravelTimeFilter)
```

## Pieces

| Concern | File | Notes |
|---|---|---|
| Parse & validate URL params | [`searchFilter.ts`](../src/routes/search/searchFilter.ts) `parseSearchParameters` | Returns a fully-typed `SearchParameters`; clamps `page`/`perPage`, drops unknown categories. |
| Build the PB filter | [`searchFilter.ts`](../src/routes/search/searchFilter.ts) `buildItemFilter` / `buildSearchFilter` | Combines name, owner-exclusion, categories, availability, owner-type and group with `&&`. |
| Server load | [`+page.server.ts`](../src/routes/search/+page.server.ts) | Reads the `items_searchable` view, sorts, paginates, logs non-empty queries. |
| Page shell + client filters | [`+page.svelte`](../src/routes/search/+page.svelte) | Wires search bar, filters, results, pagination. |
| Results grid | [`ResultsList.svelte`](../src/routes/search/ResultsList.svelte) → [`ItemCard.svelte`](../src/routes/search/ItemCard.svelte) | Takes an `ItemPublic[]` and renders cards. |
| Pagination UI | [`Pagination.svelte`](../src/routes/search/Pagination.svelte) | Page buttons + per-page selector; a GET form so no `goto()` is needed. |
| URL building | [`searchUrl.ts`](../src/routes/search/searchUrl.ts) `buildSearchUrl` | Single source of truth for constructing `/search?...` links. |
| Travel-time filter | [`TravelTimeFilter.svelte`](../src/routes/search/TravelTimeFilter.svelte) | Client-side; filters/sorts the **current page** by bucketed minutes (see below). |
| Group filter | [`GroupFilter.svelte`](../src/routes/search/GroupFilter.svelte) | Single-select dropdown of the user's groups; navigates via `buildSearchUrl`. Rendered only when the user has groups (guests never see it). |

## Which view it reads

The load reads the **`items_searchable`** view, not the base `items` collection. The view
enforces trust at the row level (public items for everyone; trustees-only items only for the
owner and users they trust) and never exposes the trust graph or raw coordinates. See
[data-model.md](data-model.md#items_public-and-items_searchable-views) for the full column list
and rules.

> The view returns **only the columns in its SELECT**. `ItemPublic` inherits `created`/`updated`
> from `PocketBaseEntity`, but a field is only populated if the view selects it — sorting on a
> column the view doesn't expose silently does nothing. Adding one requires a backend migration
> (allerleih-backend README → "Writing migrations").

## URL parameters

All discovery state lives in the URL (deep-linkable, server-rendered). Defaults in parentheses:

| Param | Meaning |
|---|---|
| `q` | free-text query; matches every whitespace token against `name`/`description` |
| `cats` | comma-separated category list (validated against `ITEM_CATEGORIES`) |
| `op` | `or` (default) / `and` — how multiple categories combine |
| `onlyAvailable` | `true` (default); `false` includes unavailable items |
| `ownerType` | `all` (default) / `institution` / `private` |
| `group` | a single group id — restrict results to items shared with that group. Only groups the requester owns or is a member of are accepted (see the security note below); anything else is silently dropped |
| `page` (1), `perPage` (20, max 50) | pagination |

### Group filter (`group`) — security

`buildItemFilter` appends a `groups ~ "<id>"` clause when a group is selected. The `~` operator
is the any-of membership match PocketBase uses for the view's `groups` column — the same operator
the group-detail page (`user/groups/[id]/+page.server.ts`) uses against the same `items_searchable`
view. The clause is built by string concatenation (the whole filter string is, by design) with
the id quote-escaped as defense-in-depth; the parser already restricts `group` to a 15-char id.

The **authorization is server-side, not UI-side** (`+page.server.ts` load): the `group` param is
only allowed to filter when the user is in `getAttachableGroups(pb, user.id)` (groups they own or
belong to). A non-member, guest, or garbage id is dropped to `null` — a shared link with a foreign
group id then just shows the unfiltered search, no error (mirroring how unknown `cats` are
ignored). This matters because URLs are shareable/editable: without the check, filtering by a
foreign group id would disclose which of the items a user can see are *also* in that group.

The `items.groups` column stays out of the `fields` allowlist regardless — it is only traversed by
the view's row rule and must never be serialized to a client (it would leak an item's *other*
group memberships). The selected group id is also **not** written to the `searches` analytics log:
it is a private social-graph datum, and the `hasQuery` logging condition is unchanged.

## Conventions / gotchas

- **Always go through `buildItemFilter` / `pb.filter`** — never interpolate values into filter
  strings (injection). Category values escape `&` so it isn't read as the `&&` operator.
- **Construct links with `buildSearchUrl`**, not hand-built query strings, so params stay
  consistent across the page, pagination, and filters.
- **Logged-in users' own items are excluded** from results (owner-exclusion filter).
- **Search logging:** non-empty queries are recorded (fire-and-forget) to the `searches`
  collection for analytics; blank default browsing is not logged.
- **Travel-time filtering is client-side and per-page** — it filters/sorts only the items
  already loaded for the current page, so pagination is hidden while that filter is active
  (see `durationFilter.paginationHidden` in `texts.ts`).
- **All user-facing strings** belong in `src/lib/texts.ts` under `pages.search`.
- **Search-bar focus & debounce** ([`SearchBar.svelte`](../src/routes/search/SearchBar.svelte)):
  typing auto-searches after a `SEARCH_DELAY_MS` (1200 ms) pause. Every programmatic `goto` uses
  `{ keepFocus: true, noScroll: true }` so the input keeps focus across the client-side
  navigation (SvelteKit otherwise resets focus to `<body>`, dropping it mid-type) and the results
  list doesn't jump to the top while typing. The debounced auto-search and the `<3`-char reset
  additionally pass `replaceState: true` so a stream of keystrokes collapses into one history
  entry; the explicit submit (Enter/button) and the clear (×) button keep their own entries
  (no `replaceState`). Initial mount focus is applied **only on desktop** — gated behind
  `window.matchMedia('(hover: hover) and (pointer: fine)')` in an `$effect`, not an `autofocus`
  attribute — so touch devices don't pop the on-screen keyboard on page load (#429/#453).
  Regression coverage: [`e2e/tests/search-focus.spec.ts`](../e2e/tests/search-focus.spec.ts).
