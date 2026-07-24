---
name: new-route
description: Scaffold a new SvelteKit route in AllerLeih the way this repo does it — +page.server.ts (load + form actions), +page.svelte (Svelte 5 runes, no data destructuring), a co-located test, and German strings in texts.ts — with the project's PocketBase guardrails baked in. Use whenever the user wants to add a new page, screen, or route, build a CRUD/form page, or "make a page for X", so the route lands consistent and isn't missing pb.filter, trust filtering, or server-side permission checks.
---

# new-route

Scaffold a route that matches the repo's conventions and avoids its recurring footguns. A route is a
folder under `src/routes/<path>/` with up to four files:

```
src/routes/<path>/
├── +page.server.ts        # load() + actions (all data + mutations)
├── +page.svelte           # UI: Svelte 5 runes, use:enhance forms
├── +page.server.test.ts   # co-located Vitest (see the write-tests skill)
└── *.svelte               # optional sub-components
```

There is **no REST layer for app data** — every read goes through `load()`, every mutation through a
**form action**. Read `docs/best-practices.md` for the canonical CRUD-form pattern before starting.

**Component placement:** a component used by only this route → co-locate it flat in the route folder
(e.g. `src/routes/items/[id]/LinkifiedText.svelte`). A cluster of components local to this route or a
subtree of it → a `components/` subfolder under that route (e.g. `src/routes/components/` for the
root layout's cluster, `src/routes/auth/components/` for auth-only pieces). A component used across
unrelated route subtrees → `src/lib/components` (design-system primitives go in `ui/`).

## 1. `load()` — reading data

```ts
import type { PageServerLoad } from './$types';
import { PUBLIC_PB_URL } from '$env/static/public';

export const load: PageServerLoad = async ({ locals }) => {
  const items = await locals.pb.collection('items').getFullList({
    filter: locals.pb.filter('owner = {:ownerId}', { ownerId: locals.user.id }),
    sort: '-updated',
  });
  return { items, PB_URL: PUBLIC_PB_URL };
};
```

Guardrails (these prevent the bugs we actually hit):
- **Every interpolated value goes through `locals.pb.filter('… = {:x}', { x })`** — never a template
  literal, even for `locals.user.id` or a route param. A raw `"` in a value is filter injection.
- **Trust/group visibility is enforced at the data layer — do NOT filter in app code.** When you list
  items that aren't exclusively the current user's own, read from a trust/group-filtered surface: the
  base `items` collection (its list/view rule returns a `trusteesOnly` item only to the owner's
  trustees + group members — via the `trusts` join back-relation `owner.trusts_via_truster.trustee`),
  or the `items_searchable` view (search/profile/sitemap). Unauthenticated browsing uses the masked
  `items_public` view. There is **no** `filterTrustedItems` helper. If you need the trust
  *relationship* itself (e.g. "does the owner trust the viewer"), use `$lib/server/trust.ts`
  (`isTrusting` / `getTrustees` / `getTrusters`) — never re-implement trust filtering client-side.
- `locals.pb` is the server client; `locals.user` is the auth record (null if unauthenticated).
- Pass `PUBLIC_PB_URL` (from `$env/static/public`) down as `PB_URL` so the client can build file URLs.

## 2. `actions` — mutations

```ts
import { fail } from '@sveltejs/kit'; // + redirect when an action navigates
import { texts } from '$lib/texts';

export const actions = {
  create: async ({ locals, request }) => {
    const form = await request.formData();
    const name = form.get('name')?.toString().trim();
    if (!name) return fail(400, { fail: true, message: texts.errors.changesNotSaved });

    await locals.pb.collection('items').create({ name, owner: locals.user.id });
    // return nothing on success → SvelteKit re-runs load() and the page refreshes
  },

  remove: async ({ locals, request }) => {
    const id = (await request.formData()).get('id')?.toString();
    if (!id) return fail(400, { fail: true, message: texts.errors.missingId });

    // ALWAYS re-fetch and check ownership server-side — never trust the form for authorization.
    const item = await locals.pb.collection('items').getOne(id).catch(() => null);
    if (!item) return fail(404, { fail: true, message: texts.errors.itemNotFound });
    if (item.owner !== locals.user.id) return fail(403, { fail: true, message: texts.errors.noPermission });

    await locals.pb.collection('items').delete(id);
  },
};
```

- Name actions to match the form's `action="?/create"`. Read `request.formData()`.
- **Validation/permission failure → `return fail(status, { fail: true, message })`** (re-renders the
  page with `form`); **navigation on success → `throw redirect(303, '/path')`** (import `redirect`
  alongside `fail` from `@sveltejs/kit`); a plain successful action returns nothing and SvelteKit
  re-runs `load()`. Reference real `texts.errors.*` keys (or add one) — don't invent key names.
- **Re-fetch the record and verify `owner === locals.user.id` before mutating.** Form fields are
  attacker-controlled — the id in the form is not proof of permission.
- Use `locals.pb.filter(...)` for any id you interpolate into a query.

## 3. `+page.svelte` — UI

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { texts } from '$lib/texts';
  import Button from '$lib/components/ui/Button.svelte';

  let { data, form } = $props();          // declare props; do NOT copy fields out of `data`
  let q = $state('');
  const visible = $derived(data.items.filter((i) => i.name.includes(q)));
</script>

<form method="POST" action="?/create" use:enhance>
  <input name="name" />
  <Button type="submit">{texts.buttons.save}</Button>
</form>

{#each data.items as item (item.id)}
  <p>{item.name}</p>
{/each}
```

- **Never destructure `data` into locals** (`let items = data.items` detaches `use:enhance`
  reactivity — the #1 footgun). Read `data.items` directly in markup; derive with `$derived`.
- Svelte 5 runes only: `$props`, `$state`, `$derived`, `$effect`, `$bindable`. No `export let`.
- Wire forms with `method="POST" action="?/name" use:enhance`.

## 4. SEO header

Every `+page.svelte` sets a `<SeoHead>` (`$lib/components/SeoHead.svelte`) — the shared component
every route in the app uses instead of hand-writing `<svelte:head>` meta tags. `title` is the only
required prop; `src/app.html` has no default `<title>`, so skipping this leaves the browser tab
showing whatever the previous page's title was.

```svelte
<script lang="ts">
  import { texts } from '$lib/texts';
  import SeoHead from '$lib/components/SeoHead.svelte';
</script>

<!-- Public / indexable route -->
<SeoHead
  title={texts.seo.myRoute.title}
  description={texts.seo.myRoute.description}
  canonical="https://allerleih.org/my-route"
/>
```

```svelte
<!-- Private / auth-gated route -->
<SeoHead title={texts.seo.myRoute.title} robots="noindex, nofollow" />
```

- Add the new page's copy under `seo:` in `src/lib/texts.ts` (`{ title, description }` for a
  static page, a function taking the relevant data for a dynamic one, following existing entries
  like `texts.seo.about` / `texts.seo.itemDetail`) — never inline the strings in the component.
- For a dynamic route, derive `title`/`description` with `$derived(...)` from load data instead of
  static values (see `src/routes/items/[id]/+page.svelte`), and pass `image` if the route has a
  natural preview image (adds the Twitter card + `og:image` automatically).
- Private/auth-gated routes still need `title`; pass `robots="noindex, nofollow"` (or `"noindex"`
  pre-login, matching `auth/register`) instead of `canonical`/`description`.
- `src/routes/+layout.svelte` already sets site-wide `og:site_name`/`og:locale` — don't repeat
  those. `SeoHead` doesn't need to know about the route's structured data either: a one-off like
  the homepage's JSON-LD `Organization` script stays in that page's own separate `<svelte:head>`
  block alongside `<SeoHead>`.
- If the new route should appear in the sitemap, see `src/routes/sitemap.xml/+server.ts` — SEO
  meta tags and sitemap inclusion are handled separately.

## 5. Strings, tests, auth

- **All user-facing German strings live in `src/lib/texts.ts`** (organised by feature) — import
  `texts` and reference them; never inline a German string in the component or the action.
- **Co-locate a test** `+page.server.test.ts` covering `load` + each action — invoke the
  **`write-tests`** skill; it knows the PocketBase-mock pattern and how to capture thrown redirects.
- **Auth is on by default.** `src/hooks.server.ts` protects every path except the `unprotectedPrefix`
  list. A new route requires login automatically. To make it public, add its prefix to
  `unprotectedPrefix` (and remember unauthenticated reads must go through the masked `*_public`
  views). Authenticated users who haven't accepted the current legal docs are gated to `/legal/accept`.
