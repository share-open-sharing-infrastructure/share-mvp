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
| Build the PB filter | [`searchFilter.ts`](../src/routes/search/searchFilter.ts) `buildItemFilter` / `buildSearchFilter` | Combines name, owner-exclusion, categories, availability, owner-type with `&&`. |
| Server load | [`+page.server.ts`](../src/routes/search/+page.server.ts) | Reads the `items_searchable` view, sorts, paginates, logs non-empty queries. |
| Page shell + client filters | [`+page.svelte`](../src/routes/search/+page.svelte) | Wires search bar, filters, results, pagination. |
| Results grid | [`ResultsList.svelte`](../src/routes/search/ResultsList.svelte) → [`ItemCard.svelte`](../src/routes/search/ItemCard.svelte) | Takes an `ItemPublic[]` and renders cards. |
| Pagination UI | [`Pagination.svelte`](../src/routes/search/Pagination.svelte) | Page buttons + per-page selector; a GET form so no `goto()` is needed. |
| URL building | [`searchUrl.ts`](../src/routes/search/searchUrl.ts) `buildSearchUrl` | Single source of truth for constructing `/search?...` links. |
| Travel-time filter | [`TravelTimeFilter.svelte`](../src/routes/search/TravelTimeFilter.svelte) | Client-side; filters/sorts the **current page** by bucketed minutes (see below). |

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
| `page` (1), `perPage` (20, max 50) | pagination |

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
