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

## Link-/Routen-Auflösung (`resolve`)

Alle **internen** Navigationen (`<a href>`, `goto()`, `pushState`/`replaceState`, Komponenten-
`href`-Props wie bei `Button`/`Card`) laufen über `resolve()` aus `$app/paths`. Der ESLint-Rule
`svelte/no-navigation-without-resolve` (empfohlen, aktiv) erzwingt das — er erkennt aber **nur
einen direkten `resolve()`-Aufruf** an der Navigationsstelle (bzw. eine Variable, deren Initializer
direkt ein `resolve()` ist). **Durch Wrapper-Funktionen oder Re-Exports sieht er nicht hindurch** —
deshalb gibt es bewusst **keinen** zentralen Routen-Helper.

**Kanonische Form: Route-ID + Params**, nicht Template-String-Interpolation:

```svelte
<!-- richtig -->
<a href={resolve('/users/[id]', { id })}>…</a>
<a href={resolve('/user/groups/[id]/members', { id: group.id })}>…</a>

<!-- falsch: Template-String, Wrapper, Re-Export -->
<a href={resolve(`/users/${id}`)}>…</a>
<a href={routeTo.user(id)}>…</a>
```

Der Route-ID-String ist ein **String-Literal** (kein Template-String), und die Param-Keys heißen
exakt wie die `[segment]`-Ordner (`[id]`, `[conversationId]`, …).

Genau **drei** gestattete Ausnahmen:

- **A — Query/Hash** gehören **in** das `resolve()`-Argument. SvelteKit reicht Query/Hash seit
  **2.26** durch `resolve()` durch; ein Disable „resolve handhabt keine Query-Strings" ist damit
  veraltet.

  ```ts
  goto(resolve(`/search?q=${encodeURIComponent(q)}`));
  goto(resolve(`/user/items?${params.toString()}`));
  ```

- **B — Wiederverwendbare URL-Builder** (`buildSearchUrl()`, `notificationHref()`) bauen ihre URL
  **intern** mit `resolve()` und geben eine fertig aufgelöste URL zurück. An der Aufrufstelle steht
  **ein** Disable mit standardisiertem Wortlaut, weil der Rule nicht durch den Aufruf sieht:

  ```ts
  // eslint-disable-next-line svelte/no-navigation-without-resolve -- buildSearchUrl() returns an already-resolved URL; the rule cannot see through the call
  goto(buildSearchUrl({ q, cats }));
  ```

- **C — Externe / benutzergelieferte URLs** werden **nie** aufgelöst: `LinkifiedText.svelte`
  (`rel="external"`) und der Footer-Redirect über `/api/redirect?to=…` (interner https-Guard +
  Klick-Tracking) bleiben unangetastet.

**Statische Dateien** aus `static/` (z. B. CSV-Vorlagen) über `asset()` (ebenfalls `$app/paths`,
seit 2.26), nicht `resolve()`:

```svelte
<a href={asset('/templates/items-import-template.csv')} download>…</a>
```

`redirect()` in Server-`load`-Funktionen / `hooks.server.ts` fällt **nicht** unter den Rule und
bleibt daher unverändert (heute `base=''`, also identisch). Würde je ein `base`-Pfad gesetzt,
müssten diese Redirect-Ziele durch `resolve()` laufen.
