# Design System

How UI styling is centralized in AllerLeih: the theme token palette, the shared `Button`
component, and the white-labeling mechanism. The goal is that every interactive element
shares one look & feel, design changes happen in one place, and the whole platform can be
re-skinned for other operators without touching markup.

## Theme tokens

The entire color palette lives as Tailwind CSS v4 `@theme` variables in `src/app.css`
(there is no `tailwind.config.js` — Tailwind v4 is configured in CSS):

| Token | Purpose |
|---|---|
| `primary` (+ 50–900 scale) | Brand color; default button fill, links |
| `secondary` (+ scale) | Secondary brand color |
| `accent` (+ scale) | Attention color: prompts, highlights |
| `tinte` (+ scale) | Neutral ink scale: text, borders, subtle surfaces |
| `danger` | Destructive actions |
| `safety` | Positive/success signals |
| `papier`, `sand` | Background surfaces |

Rules:

- **Components use only these tokens** — never `gray-*`/`blue-*` Tailwind default colors
  and never hex values in markup. If a shade is missing, add it to `@theme`.
- Dark mode uses the class strategy (`.dark` on an ancestor) via the `dark:` variant.

## Button

**Component:** `src/lib/components/ui/Button.svelte` — the single way to render a button
or button-styled link in the app.

```svelte
<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { PenOutline } from 'flowbite-svelte-icons';
</script>

<Button type="submit" loading={submitting}>{texts.actions.save}</Button>
<Button variant="secondary" onclick={cancel}>{texts.actions.cancel}</Button>
<Button href="/items/{item.id}" size="lg" fullWidth>{texts.items.view}</Button>
<Button variant="ghost" size="icon" aria-label={texts.actions.edit}>
	<PenOutline class="h-4 w-4" />
</Button>
<Button color="accent" size="xl">{texts.pages.landing.ctaButtonUpload}</Button>
```

### Props

| Prop | Values | Default | Notes |
|---|---|---|---|
| `variant` | `primary` · `secondary` · `ghost` · `accent` · `danger` · `link` | `primary` | See table below |
| `size` | `sm` · `md` · `lg` · `xl` · `icon` · `icon-sm` | `md` | `icon*` sizes are square; require `aria-label`. `xl` is for rare, prominent single CTAs (landing hero) — reach for `lg` first |
| `color` | `primary` · `secondary` · `accent` | `primary` | **Only affects `variant="primary"`.** Swaps the soft-fill hue only — border/text/shape stay identical. For cases like two side-by-side CTAs that should look the same except for color (see landing page). Has no effect on other variants — `danger`/`accent`/etc. keep their fixed, semantic colors. |
| `loading` | `boolean` | `false` | Shows spinner, disables the button, sets `aria-busy` |
| `fullWidth` | `boolean` | `false` | Adds `w-full` |
| `href` | `string` | — | Renders an `<a>` instead of `<button>` (disabled → `aria-disabled` + `pointer-events-none`) |
| `type` | native | `button` | Defaults to `button` (not `submit`) to prevent accidental form submits |
| `class` | `string` | — | **Layout-only** — see policy below |

All other native attributes (`onclick`, `name`, `value`, `formaction`, `aria-*`, `title`,
`target`, `rel`, …) pass through typed.

### Variants — when to use which

| Variant | Look | Use for |
|---|---|---|
| `primary` | Soft `primary-200` fill, ink border, saturates on hover | The main action of a view (submit, CTA). Use `color` if you need the same soft-fill shape in `secondary`/`accent` hue instead — don't reach for `accent` variant just for the color, since that variant is a different (solid/loud) shape reserved for banners/prompts. |
| `secondary` | Outlined, neutral | Cancel / secondary actions next to a primary |
| `ghost` | Text-only, no border | Tertiary actions, icon buttons, dismiss |
| `accent` | Solid accent, white text | Prompts/toasts that must stand out (PWA install, onboarding nudge) |
| `danger` | Solid `danger`, white text | Destructive actions (delete account, remove) |
| `link` | Inline text link styling | Button-in-prose, "show more", nav-like actions |

### The `class` policy: layout only

`class` exists so call sites can position the button — **never restyle it**:

- ✅ Allowed: width/flex (`w-full sm:w-auto`, `shrink-0`), spacing (`mt-4`, `me-2`),
  positioning (`fixed right-10 bottom-10 z-50`).
- ❌ Not allowed: colors, borders, radii, font, padding overrides. If a design need isn't
  covered, extend the variant/size maps in `Button.svelte` so every button benefits.

If you find yourself reaching for `class` to get a look outside those bounds, that's the
signal to add a variant or size to `Button.svelte` instead — so the need is shared by
every future button, not solved once and re-solved differently next time. A page-specific
`class` override that changes how a button *looks* (rather than where it sits) is exactly
the kind of one-off drift this component exists to prevent.

There is deliberately no class-merging library: appended conflicting utilities do not
reliably win (Tailwind specificity is stylesheet order, not class order), so color
overrides via `class` will misbehave — another reason not to try.

### Loading & disabled

Bind your `use:enhance` submitting flag to `loading` — that is the unified pattern:

```svelte
<form method="POST" action="?/save" use:enhance={() => {
	submitting = true;
	return async ({ update }) => { await update(); submitting = false; };
}}>
	<Button type="submit" loading={submitting}>{texts.actions.save}</Button>
</form>
```

`loading` handles the spinner, `disabled`, and `aria-busy` — no ad-hoc spinners or
`disabled:opacity-*` classes at call sites.

### Icons

Put icon components (from `flowbite-svelte-icons`, `…Outline` set) directly in the
children snippet — the button's `gap-2` spaces them; no `mr-2` needed. Icon-only buttons
(`size="icon"` / `"icon-sm"`) must set `aria-label` with a German string from
`src/lib/texts.ts`.

### What is *not* a Button

- **Filter chips / toggles** (search filters, travel-time chips): stateful
  selected/unselected controls — a different component family (future `ui/Chip.svelte`).
- **`SparkleButton`** (used by `FeedbackButton`, the site-wide feedback nudge): the **one
  deliberate exception** to "always use `Button`". Its animated gradient/shimmer/sparkle
  treatment is the intended effect — an eye-catching nudge, not a missed migration — and
  it already consumes `var(--color-*)` tokens, so it white-labels correctly. Any future
  exception needs the same bar: a real, reasoned need to look different, documented here —
  not a silent bypass of the component.

## White-Labeling

Because Tailwind v4 emits every `@theme` token as a `:root` CSS custom property and
utilities reference them via `var()`, re-skinning the platform is a pure CSS override —
no markup or component changes:

1. Add a `[data-theme='<operator>']` block in `src/app.css` next to the `@theme` block,
   overriding the `--color-*` tokens the operator wants changed (at minimum the shades
   the design system uses: base + `200`/`400`/`600` of `primary`, plus `accent` if used).
   For avatar contrast, don't work from a shade list here — `COLOR_PALETTE` in
   `src/lib/components/InitialsAvatar.svelte` is the source of truth for which pairs must
   stay above the 4.5:1 AA floor, and it spans more families than `primary`/`accent`.
   Override a family and you own re-checking every pair it appears in.
2. Set `data-theme="<operator>"` on `<html>` in `src/app.html` (or dynamically on a
   wrapper element).

Every component built on the tokens — including `Button` — re-skins automatically. An
`example` block in `app.css` documents the pattern.

This covers **colours** only. The other two axes of "run this for another city" are handled
elsewhere: **name/origin/contact/analytics** come from `src/lib/instance.ts` (see
`docs/architecture.md` → "Instance configuration"), and **binary assets** (logo, icons,
`manifest.webmanifest`) are swapped statically under unchanged filenames via a per-instance
overlay — not part of this CSS mechanism.

## Adding new design-system components

New shared primitives (`Chip`, `Input`, …) go in `src/lib/components/ui/`, follow the
same shape (typed variant/size maps of token-only Tailwind classes, Svelte 5 runes,
snippet children), and get documented here.
