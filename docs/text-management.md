# Text Management

## Overview

AllerLeih uses a centralized text management system to keep all German UI strings in one place and prepare for future internationalization. All user-facing text lives in `src/lib/texts.ts`.

## Structure

### Central Text Repository

`src/lib/texts.ts` exports two things: the `ITEM_CATEGORIES` constant and the `texts` object. The top-level keys of `texts` map to functional areas of the app:

```typescript
export const ITEM_CATEGORIES = [
    'Freizeit und Sport',
    'Werkzeug und Garten',
    'Reisen und Outdoor',
    'Bücher',
    'Spiele',
    'Küche',
    'Ton und Licht',
    'Elektronik',
    'Für Kinder',
    'Sonstiges',
] as const;

export const texts = {
    names: { ... },           // App display name, contact email
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

1. Add your text to the appropriate category in `src/lib/texts.ts`
2. Use it in your component or server file via the import above
3. Keep texts organized by functional area; use function signatures for dynamic values

## Categories

| Key | Contents |
|---|---|
| `ITEM_CATEGORIES` | Exported const array: the 10 fixed item categories used for filtering and AI prompts |
| `names` | App display name, contact email |
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
| `pages` | Large per-page text objects, keyed by route name |
| `bulkUpload` | AI bulk photo upload workflow texts (institution import flow) |
| `onboarding` | 10-step post-registration onboarding wizard texts |
| `notifications` | Notification inbox text; also contains the push notification title |
| `lending` | Lending workflow status labels, action buttons, and role-specific descriptions (owner vs. borrower) |
| `seo` | `<title>` and `<meta description>` values for each page |
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
