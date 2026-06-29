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

## 1. `load()` — reading data

```ts
import type { PageServerLoad } from './$types';
import { filterTrustedItems } from '$lib/server/itemFilters';
import { PUBLIC_PB_URL } from '$env/static/public';

export const load: PageServerLoad = async ({ locals }) => {
  const items = await locals.pb.collection('items').getFullList({
    filter: locals.pb.filter('owner = {:ownerId}', { ownerId: locals.user.id }),
    sort: '-updated',
    expand: 'owner', // required: filterTrustedItems reads item.expand.owner.trusts
  });
  return { items: filterTrustedItems(items, locals.user.id, true), PB_URL: PUBLIC_PB_URL };
};
```

Guardrails (these prevent the bugs we actually hit):
- **Every interpolated value goes through `locals.pb.filter('… = {:x}', { x })`** — never a template
  literal, even for `locals.user.id` or a route param. A raw `"` in a value is filter injection.
- **Call `filterTrustedItems(items, locals.user?.id ?? null, !!locals.user)`** (synchronous; from
  `$lib/server/itemFilters`) after fetching items that aren't exclusively the current user's own —
  skipping it **leaks** `trusteesOnly` items to non-trusted viewers. It checks
  `item.expand?.owner?.trusts`, so the same fetch **must** `expand: 'owner'`, or trusted viewers are
  wrongly denied (it fails closed).
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

  let { data, form } = $props();          // declare props; do NOT copy fields out of `data`
  let q = $state('');
  const visible = $derived(data.items.filter((i) => i.name.includes(q)));
</script>

<form method="POST" action="?/create" use:enhance>
  <input name="name" />
  <button type="submit">{texts.buttons.save}</button>
</form>

{#each data.items as item (item.id)}
  <p>{item.name}</p>
{/each}
```

- **Never destructure `data` into locals** (`let items = data.items` detaches `use:enhance`
  reactivity — the #1 footgun). Read `data.items` directly in markup; derive with `$derived`.
- Svelte 5 runes only: `$props`, `$state`, `$derived`, `$effect`, `$bindable`. No `export let`.
- Wire forms with `method="POST" action="?/name" use:enhance`.

## 4. Strings, tests, auth

- **All user-facing German strings live in `src/lib/texts.ts`** (organised by feature) — import
  `texts` and reference them; never inline a German string in the component or the action.
- **Co-locate a test** `+page.server.test.ts` covering `load` + each action — invoke the
  **`write-tests`** skill; it knows the PocketBase-mock pattern and how to capture thrown redirects.
- **Auth is on by default.** `src/hooks.server.ts` protects every path except the `unprotectedPrefix`
  list. A new route requires login automatically. To make it public, add its prefix to
  `unprotectedPrefix` (and remember the `*_public` views + `filterTrustedItems` for unauthenticated
  reads). Authenticated users who haven't accepted the current legal docs are gated to `/legal/accept`.
