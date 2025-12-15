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
<script lang="ts">const {data} = $props(); let trustees = data.trustees;</script>
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
