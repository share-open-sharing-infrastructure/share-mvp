# Text Management

## Overview

AllerLeih uses a centralized text management system to keep all German UI strings in one place and prepare for future internationalization. All user-facing text lives in `src/lib/texts.ts`.

## Structure

### Central Text Repository

`src/lib/texts.ts` exports the `texts` object. (The item categories are domain data, not UI copy — they live in `src/lib/categories.ts`; see `docs/data-model.md` → "Item categories".) The top-level keys of `texts` map to functional areas of the app:

```typescript
export const texts = {
    names: { ... },           // App display name, city, contact email
    auth: { ... },            // Login, registration, password reset
    nav: { ... },             // Navigation menu items
    footer: { ... },          // Social media links
    errors: { ... },          // Error messages
    success: { ... },         // Success/confirmation messages
    feedback: { ... },        // Feedback form labels
    messenger: { ... },       // Telegram and Signal contact section
    forms: { ... },           // Form field labels and placeholders
    buttons: { ... },         // Button labels
    ui: { ... },              // General UI elements; many entries are functions
    itemStatus: { ... },      // Item availability status labels
    pages: { ... },           // Large per-page text objects, keyed by route
    bulkUpload: { ... },      // AI bulk photo upload workflow
    onboarding: { ... },      // 10-step post-registration onboarding wizard
    notifications: { ... },   // Notification inbox; also push notification title
    lending: { ... },         // Lending workflow status labels and actions
    seo: { ... },             // <title> and <meta description> values
    onboardingPrompt: { ... },// Nudge banner for users who skipped onboarding
    pwa: { ... },             // PWA install prompt and notification permission banner
    alerts: { ... },          // Flash message prefix strings
    institutional: { ... },   // Institution badge, CSV import UI, external CTA
    lendingTerms: { ... },    // Terms acceptance modal (institutional lending)
    counterfactual: { ... },  // Post-loan "what would you have done?" survey
};
```

## Usage

### In Svelte Components

```svelte
<script lang="ts">
    import { texts } from '$lib/texts';
</script>

<span>{texts.forms.email}</span>
<input placeholder={texts.auth.emailPlaceholder} />
<button>{texts.buttons.save}</button>

<!-- Dynamic text with parameters -->
<p>{texts.ui.resultsFound(itemCount)}</p>
```

### In Server Files

```typescript
import { texts } from '$lib/texts';

return fail(400, {
    fail: true,
    message: texts.errors.loginFailed,
});
```

## Adding New Text

0. First decide **where** the string belongs — generic UI copy vs. instance-specific content —
   per the rule in "Instance-specific content vs. generic UI strings" below. Most strings are
   generic UI copy and go straight into `texts.ts`; only genuinely instance-specific prose goes
   into `instance-content.ts`.
1. Add your text to the appropriate category in `src/lib/texts.ts`
2. Use it in your component or server file via the import above
3. Keep texts organized by functional area; use function signatures for dynamic values

## Instance-specific content vs. generic UI strings

Two modules feed instance-related copy into `texts.ts`, and they're not interchangeable:

- **`src/lib/instance.ts`** — instance-*derived* scalars/URLs (city, origin, contact/feedback
  email, social links, analytics config). These are values a template interpolates; the wording
  around them stays identical across instances.
- **`src/lib/instance-content.ts`** — instance-*specific* prose. Content whose actual wording
  (not just a variable inside it) would need to change if AllerLeih relaunched in a different
  city with a different team.

**Boundary rule:** would this string's wording need to change (not just a variable substituted
into it) if AllerLeih relaunched in a different city with a different team?
- Yes → `instance-content.ts`.
- No, it only needs `CITY`/`APP_NAME`/an email substituted into an otherwise-identical template →
  stays in `texts.ts`, parameterized from `$lib/instance.ts` as today.

**Concrete example:** the FAQ founder-bio answer (`texts.pages.guide.faqItems[0].a`, "Wer seid
ihr?") is biographical — it names the founders and says they studied in Lüneburg. That's true
regardless of which city currently runs the instance, so it's *not* `CITY`-interpolated; it lives
verbatim in `instanceContent.faq.whoWeAre` (`src/lib/instance-content.ts`) and `texts.ts` just
references it.

**Guardrail:** like `$lib/instance`, never import `$lib/instance-content` from
`src/service-worker.ts`.

See `instance-content.ts`'s own top-of-file doc comment for the full rationale.

## Categories

| Key | Contents |
|---|---|
| `names` | App display name, city, contact email — `app`/`city`/`mainContactMail` are interpolated from `$lib/instance.ts` at module load, not hardcoded |
| `auth` | Login/register/reset form labels and placeholders |
| `nav` | Navigation menu items |
| `footer` | Social media link labels |
| `errors` | All user-facing error messages |
| `success` | Success/confirmation messages |
| `feedback` | Feedback form labels (in-app feedback widget) |
| `messenger` | Telegram and Signal contact section |
| `forms` | Form field labels and input placeholders |
| `buttons` | Button labels |
| `ui` | General UI elements; many entries are functions `(value: T) => string` for dynamic values |
| `itemStatus` | Item availability status display labels |
| `pages` | Large per-page text objects, keyed by route name. Exception: `pages.guide.faqItems[0].a` ("Wer seid ihr?") is sourced from `instanceContent.faq.whoWeAre` in `src/lib/instance-content.ts` — see "Instance-specific content vs. generic UI strings" below |
| `bulkUpload` | AI bulk photo upload workflow texts (institution import flow) |
| `onboarding` | 10-step post-registration onboarding wizard texts |
| `notifications` | Notification inbox text; also contains the push notification title |
| `lending` | Lending workflow status labels, action buttons, and role-specific descriptions (owner vs. borrower) |
| `seo` | `<title>` and `<meta description>` values for each page. The entries with local search intent (`home`, `search`, `about`, `guide`, `contact`, `itemDetail*`) interpolate the city from `CITY` (`$lib/instance.ts`) and must never hardcode it — one build serves several city instances, and a test enforces it. `APP_NAME` is only partially adopted; the block comment above `seo` in `texts.ts` explains why and lists the pages deliberately left without a city. Title ≤ 60 / description ≤ 155 chars is the guideline; it is enforced only for the local-intent entries (`LOCAL_PAGES` in `src/lib/texts.test.ts`) — some older strings exceed it |
| `onboardingPrompt` | Nudge banner shown to users who skipped or have not completed onboarding |
| `pwa` | PWA install prompt and browser notification permission banner |
| `alerts` | Flash message prefix strings |
| `institutional` | Institution badge, CSV import UI labels, external system CTA |
| `lendingTerms` | Terms acceptance modal used when borrowing from institutions with active lending terms |
| `counterfactual` | Post-loan "what would you have done without AllerLeih?" survey for impact research |

## Best Practices

1. **Be specific:** Use descriptive keys that indicate the context
2. **Keep it organized:** Group related texts together in the correct top-level category
3. **Use functions for dynamic text:** `(name: string) => \`Hallo, ${name}!\`` instead of concatenation in components
4. **Never hardcode:** Never put German UI text directly in components or server files
