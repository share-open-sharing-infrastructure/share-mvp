# Best Practices

This document aims to - well - document certain best practices for implementing recurring patterns in our code base. This is, of course, more of a guideline than a hard rule, but should help contributors understand how and why certain things are done the way they are.

## (CRUD) Forms

We have found that creating well-running forms can give you some headache, but have also found that actually, Svelte(Kit) is making it pretty smooth once you know how.
For the official SvelteKit tutorial, see: https://svelte.dev/tutorial/kit/the-form-element and the subsequent tutorial elements.

In this app, forms are basically connected to three separate components:

1. The HTML form itself (in the +page.svelte component).
2. The action that is triggered by the form submission (in the +page.server.ts actions object).
3. The data (re-)loading that happens as an effect of the form updated database state (in the +page.server.ts load function).

I'll briefly use the example of the ["Trust" function](/src/routes/social/) to illustrate how this works.

In the client-side component [/src/routes/social/+page.svelte](/src/routes/social/+page.svelte), we have (1) a form element for submitting data and (2) a list of trusted persons:

### The HTML Form

**HTML Form element:**

```html
<form method="POST" action="?/addtrustee" use:enhance="{...}">
	<input name="trusteeId" value="{potentialtrustee.id}" />
	<button class="..." type="submit">...</button>
</form>
```

The important parts here concern the `action` and `use:enhance` props. `action="?/addtrustee"` points the form to the `addtrustee()`-function on the server-side (see below). `use:enhance` takes care of a smoother user experience if JavaScript is enabled. Basically, here, it updates any changed data without fully reloading the page (see [Progressive Enhancement](https://svelte.dev/tutorial/kit/progressive-enhancement)). Crucially, however, use:enhance _only_ works if data is passed to the component properly:

**List of trusted persons**

```html
<!-- We need to use "data.trustees" and not some destructured variable "currenttrustees" or sth -->
{#each data.trustees as trustee}
<div class="...">
	<img ... />
	<div>
		<p class="...">@{trustee.username}</p>
	</div>
</div>
{/each}
```

The important part here is that we **do not destructure the data object**. For ease of use, one might be tempted to do something like this in the script section of the component:

```js
<script lang="ts">
	const {data} = $props(); let trustees = data.trustees;
</script>
```

However, this detaches the Svelte-internal reactivity from database updates, and hence deactivates the "use:enhance" functionality. Therefore, if a UI component should react to form actions, it needs to be getting its data directly from the "data"-prop.

### Editable fields: seed-once + `bind:`, never one-way `value=`

**Rule:** once a form field is user-editable, its DOM value must come from `bind:value` (or
`bind:checked`, …) backed by a local `$state` that is **seeded once** from the loaded value —
never a one-way `value={…}` fed by a prop or by `data`. Seed it once and don't re-sync it
afterwards:

```svelte
<script lang="ts">
	let { bio }: { bio: string } = $props();

	// Seed once from the loaded value; bind: takes over from here.
	// svelte-ignore state_referenced_locally
	let bioValue = $state(bio);
</script>

<textarea name="bio" bind:value={bioValue}></textarea>
```

**Why:** a one-way `value={…}` compiles to a `set_value()` call with no memory of what the DOM
already holds. On an ordinary re-render this is harmless — `set_value` caches the last value it
wrote and skips a redundant write. But its very **first** pass, at hydration, has no cache yet:
it writes the loaded value over the DOM **unconditionally**, clobbering anything the user already
typed into the server-rendered input before the JS bundle finished loading (real on slower
connections/devices — issue #558, where text typed during that window was silently discarded and
an empty value saved instead, behind a success toast). `bind:value` compiles to `bind_value`,
which carries a hydration guard: it **adopts** the DOM's existing value instead of overwriting
it, so pre-hydration input survives. The server-rendered HTML is identical either way — this is
a hydration-safety fix, not a no-JS regression.

Reference implementation: the `src/routes/user/profile/` section components —
`ExternalLendingInfoSection.svelte`, `ProfileBasicsSection.svelte` and `ContactSection.svelte`
keep the prop's own name and suffix the local `$state` with `Value` (`bio` → `bioValue`);
`MessengerField.svelte` instead renames the *prop* to `initialValue` and keeps the local named
`value` — see the escape hatch below for why. The `// svelte-ignore state_referenced_locally`
comment is required immediately above the seeding `$state(...)` line — the compiler warns
whenever a `$state` initializer reads another reactive value (a prop, here) — but only where the
warning actually fires; `svelte/no-unused-svelte-ignore` is an error-level lint rule, so don't add
the comment speculatively.

**Escape hatch — when the prop is already named `value`:** `let { value } = $props()` followed by
`let value = $state(value)` is a duplicate `let value` declaration in the same scope — a
compile-time parse error, not shadowing (shadowing needs two distinct scopes) — so one of the two
names must change. Rename the *prop* to `initialValue` (not the local) and keep the local `$state`
named `value`, so the input can use the bare `bind:value` shorthand and the seed-once contract
stays visible at the call site. See `MessengerField.svelte`.

**Two anti-patterns that look like fixes but reintroduce the bug in a different shape:**

- **A writable `$derived` (e.g. `$lib/stores/realtimeSynced.svelte.ts`) that re-seeds the field
  whenever its source changes.** The root layout (`src/routes/+layout.svelte`) invalidates
  `NOTIFICATIONS_DEP` after every navigation and on every realtime reconnect. A field wired
  through a primitive that re-syncs on invalidation doesn't just clobber at hydration — it
  discards unsaved input on the next navigation or reconnect, too. (`realtimeSynced` is the
  right tool when re-sync-on-invalidate is the actual goal, e.g. realtime conversation state —
  just not for a plain editable field.)
- **A sync `$effect` that re-seeds the local `$state` from the prop.** Same discard-on-invalidate
  problem as above, and `svelte/prefer-writable-derived` is an error-level lint rule that
  specifically flags this shape — treat that as a correct rejection of the pattern here, not a
  style nit to suppress.

This doesn't change the "never destructure the `data` prop" rule above: the page's `data` prop
itself stays one-way and un-destructured. That rule is about not *detaching* reactivity from
`data`; this one is about not letting that reactivity *clobber* in-progress input on a field the
user can type into. Seeding a local `$state` from `data.x` once, at initialization, reads `data.x`
exactly once and does not detach anything.

**A wrapper that binds internally does not make an outer one-way `value=` safe** (issue #613).
Flowbite's `Input`/`Textarea` declare `value = $bindable()` and bind the underlying element
internally, so `bind_value`'s hydration guard already applies *inside* them — but without `bind:`
from the outside the child's prop is a plain writable derived, and every recompute restores what
the parent passed. `+layout.svelte` fires `invalidate(NOTIFICATIONS_DEP)` from `afterNavigate`
even on first load, so the layout load re-runs right after hydration, SvelteKit rebuilds `data`
for every node below it, and the adopted text is discarded. Seed once and `bind:` from the
outside too.

**Sweep criterion — "is the field in the server-rendered HTML?"** Only fields a user can reach
*before* hydration are in this bug class. Fields behind an `{#if}` (modal bodies, wizard steps
such as `src/routes/onboarding/`) are not, and there re-seeding on remount is usually the
*desired* behaviour — see `src/routes/user/items/ItemModal.svelte`.

**Open case — URL-synced fields** (tracked as issue #619). `/user/items`' search box syncs from the URL
(`$derived(data.search)`) so back/forward and a filter reset win, which rules seed-once out. But
`bind:value` on that writable `$derived` does not fix #613 either: measured in a hydrated browser
reproduction, the binding *does* adopt the pre-hydration text, and the `afterNavigate` invalidate
above then recomputes the derived and overwrites it a few ms later. Neither shape is correct
today — don't "fix" such a field with either one without solving the re-sync trigger first.

### The submit action

Submit actions are defined in the server-side `+page.server.ts` file like so:

```typescript
...
export const actions = {
    addtrustee: async ({ request, locals }) => {
        const formData = await request.formData()
        const newTrusteeId = formData.get('trusteeId');

        const updateData = {
            trusts: [...(locals.user.trusts || []), newTrusteeId]
        };

        try {
            const record = await locals.pb
                .collection('users')
                .update(locals.user.id, updateData);
        } catch (err) {
            console.error(err?.message || err);
        }
    },
    removetrustee: ...
};
```

Here, we see the counter-part to the "addtrustee"-submit action of the form. You can get the form data via the request object, and in this case have to update the list of users that the logged-in user trusts. We have found that this works smoothest by creating an updateData object which - in this case - appends the id of the newly-to-be-trusted user to the existing ones and then calls the underlying database accordingly. After this, there is actually nothing you have to take care of - SvelteKit and the enhance-function take care of updating the UI in reaction to any underlying DB changes.

### Shared server form helpers

When the *same* entity is created/edited from more than one form, don't duplicate the
FormData-to-payload logic in each action — extract it into a `$lib/server/*` module and keep the
actions thin. Field **extraction**, **validation** and **sanitization** belong in the helper; the
action only orchestrates (validate → sanitize → `pb.create/update` → `fail`/`redirect`). This way a
new field is wired **once**, both flows stay consistent, and the payload is typed instead of a
`Record<string, any>`.

The canonical example is **`$lib/server/itemForm.ts`**, shared by the single add/edit action
(`user/items/+page.server.ts`) and the bulk add action (`user/items/bulk-add/+page.server.ts`):

- `extractItemForm(data)` / `extractBulkItemDraft(data, i)` — read each form's own wire format
  (the wire formats stay flow-specific; only the logic between "FormData in" and "payload out" is
  shared).
- `validateItemFields(input, { requireImage })` — one validator for both flows. Its error-flag
  keys (`nameIsMissing` … `tooManyImages`) are **API**: `ItemModal.svelte` and the route tests key
  off them, so don't rename them.
- `sanitizeCategories` and `sanitizeGroups` / `filterAttachableGroups` — the **security-relevant**
  bits. `sanitizeGroups` filters submitted group ids against `getAttachableGroups` (owned + member)
  so a tampered form can't share an item into arbitrary groups; never weaken this. In a per-row
  loop (bulk), load the attachable set **once** per request and reuse `filterAttachableGroups`,
  rather than re-querying per row.
- `ItemWritePayload` — the typed create/update payload; `image` is only set when new files were
  uploaded (on update, omitting it keeps the existing images).

Characterize before you extract: the single-flow route test is the no-behavior-change anchor (it
must stay green *unchanged*), and the bulk flow got a characterization test written **before** the
refactor. Any deliberate behavior change (here: the MIME whitelist now also applies to bulk rows)
is called out in a test comment.

### Sidecar singleton rows (`$lib/server/singletonRow.ts`)

Several collections hold **at most one row per user** alongside the `users` record —
`user_preferences`, `user_contacts`, `user_geolocations`, `lending_requirements`. Writing them is
always a find-then-write, which is not atomic: a double-submit (or two tabs) makes two requests
race over the same row, and the loser fails on a row that is already in the state it wanted.

Never hand-roll that write. Route it through the two helpers, which carry the guard once:

- `upsertSingletonRow({ pb, collection, find, createData, patch })` — update if the row exists,
  otherwise create. A lost create race (unique index on the owning relation) is retried as an
  update instead of surfacing as a failed save.
- `deleteSingletonRow({ pb, collection, find })` — the clear path. Deletes if a row exists, no-ops
  if not, and tolerates a lost delete race (someone else already removed the row).

Both guards settle "did I lose the race?" by **re-reading the state**, never by trusting the status
code: PocketBase answers 404 both for "already gone" and for "a rule or hook refused this delete",
so the delete guard only swallows the 404 once `find` confirms the row really is gone. Everything
else throws — a write that genuinely failed must never be reported as done.

The same reasoning applies to the `find` callback itself: resolve "no row" from a **404 only** and
rethrow the rest. A blanket `catch { return null }` turns a 500 into "the user has no row", which
on the clear path skips the delete and still reports success — the data stays stored (#612). That
is load-bearing wherever `deleteSingletonRow` is used. The upsert-only sidecars
(`user_preferences`, `lending_requirements`) still use a blanket catch, which survives there
because a swallowed error resurfaces on the create that follows.

Both helpers take the same `find`, so a module like `$lib/server/geolocation.ts` defines the lookup
once and reuses it for both directions. Keeping the guards here rather than at the call sites is
deliberate: they were each fixed one call site at a time before being centralised (#586 for the
create race, #612 for the delete race), and the next sidecar collection should get them for free.

### Data (Re-)Loading

The load function passes the data to the UI component:

```ts
export async function load({ locals }) {

    let trustees;
    let users;

    try {
        users = await locals.pb.collection('users').getFullList()
        trustees = users.filter(
            user => locals.user.trusts && locals.user.trusts.includes(user.id)
        );
    } catch (error) {
        ...
    }

    return {
        users: users,
        trustees: trustees.map(...) ?? []
    };
}
```

There's actually not much to say here except that this should handle errors properly. Otherwise, it just runs well in conjunction with the SvelteKit mechanisms explained above.

## Link / route resolution (`resolve`)

All **internal** navigation (`<a href>`, `goto()`, `pushState`/`replaceState`, component `href`
props like on `Button`/`Card`) goes through `resolve()` from `$app/paths`. The ESLint rule
`svelte/no-navigation-without-resolve` (recommended, enabled) enforces this — but it only
recognises **a direct `resolve()` call** at the navigation site (or a variable whose initializer
is directly a `resolve()`). **It cannot see through wrapper functions or re-exports** — so there
is deliberately **no** central route helper.

**Canonical form: route ID + params**, not template-string interpolation:

```svelte
<!-- correct -->
<a href={resolve('/users/[id]', { id })}>…</a>
<a href={resolve('/user/groups/[id]/members', { id: group.id })}>…</a>

<!-- wrong: template string, wrapper, re-export -->
<a href={resolve(`/users/${id}`)}>…</a>
<a href={routeTo.user(id)}>…</a>
```

The route-ID string is a **string literal** (not a template string), and the param keys are named
exactly like the `[segment]` folders (`[id]`, `[conversationId]`, …).

Exactly **three** permitted exceptions:

- **A — Query/hash** belong **inside** the `resolve()` argument. SvelteKit passes query/hash
  through `resolve()` since **2.26**, so a disable saying "resolve doesn't handle query strings" is
  stale.

  ```ts
  goto(resolve(`/search?q=${encodeURIComponent(q)}`));
  goto(resolve(`/user/items?${params.toString()}`));
  ```

- **B — Reusable URL builders** (`buildSearchUrl()`, `notificationHref()`) build their URL
  **internally** with `resolve()` and return an already-resolved URL. At the call site there is
  **one** disable with a standardised wording, because the rule cannot see through the call:

  ```ts
  // eslint-disable-next-line svelte/no-navigation-without-resolve -- buildSearchUrl() returns an already-resolved URL; the rule cannot see through the call
  goto(buildSearchUrl({ q, cats }));
  ```

- **C — External / user-supplied URLs** are **never** resolved: `LinkifiedText.svelte`
  (`rel="external"`) and the redirect-proxy builders `buildRedirectHref()`/`buildItemRedirectHref()`
  (`/api/redirect?to=…`; internal https guard + click tracking) stay untouched.

**Static files** from `static/` (e.g. CSV templates) go through `asset()` (also `$app/paths`,
since 2.26), not `resolve()`:

```svelte
<a href={asset('/templates/items-import-template.csv')} download>…</a>
```

`redirect()` in server `load` functions / `hooks.server.ts` is **not** covered by the rule and
therefore stays unchanged (today `base=''`, so identical). If a `base` path were ever set, these
redirect targets would need to go through `resolve()`.
