# Text Management and Internationalization

## Overview

The Share MVP platform uses a centralized text management system to prepare for internationalization (i18n) and make text updates easier to manage. All user-facing text is centralized in `src/lib/texts.ts`.

## Structure

### Central Text Repository

The main text repository is located at `src/lib/texts.ts` and contains all user-facing text organized by categories:

```typescript
export const texts = {
	// Authentication-related text
	auth: {
		emailPlaceholder: 'E-Mail Adresse',
		passwordPlaceholder: '••••••••••',
		loginFailed: 'Login fehlgeschlagen.',
		// ... more auth texts
	},

	// Navigation text
	nav: {
		login: 'Login',
		register: 'Registrieren',
		// ... more navigation texts
	},

	// Error messages
	errors: {
		changesNotSaved: 'Die Änderungen konnten nicht gespeichert werden!',
		// ... more error messages
	},

	// Success messages
	success: {
		changesSaved: 'Die Änderungen wurden gespeichert!',
		// ... more success messages
	},

	// Form labels and placeholders
	forms: {
		username: 'Nutzername',
		// ... more form texts
	},

	// Buttons
	buttons: {
		save: 'Speichern',
		// ... more button texts
	},

	// General UI text
	ui: {
		resultsFound: (count: number) => `${count} Dinge gefunden`,
		// ... more UI texts
	},

	// Page-specific text
	pages: {
		about: {
			title: 'Über AllerLeih',
			// ... page-specific texts
		},
		// ... more pages
	},
};
```

## Usage

### In Svelte Components

Import the texts and use them directly in your components:

```svelte
<script lang="ts">
	import { texts } from '$lib/texts';
</script>

<!-- Use in HTML -->
<span>{texts.forms.email}</span>
<input placeholder={texts.auth.emailPlaceholder} />
<button>{texts.buttons.save}</button>

<!-- For dynamic text with parameters -->
<p>{texts.ui.resultsFound(itemCount)}</p>
```

### In Server Files

Import and use texts in your server-side code:

```typescript
import { texts } from '$lib/texts';

// Use in error responses
return fail(400, {
	fail: true,
	message: texts.errors.loginFailed,
});

// Use in success responses
return {
	success: true,
	message: texts.success.changesSaved,
};
```

## Adding New Text

1. **Add to the central repository**: Add your new text to the appropriate category in `src/lib/texts.ts`
2. **Use the text**: Import and use the text in your component or server file
3. **Follow the structure**: Keep texts organized by their functional area

## Benefits

1. **Centralized Management**: All text in one place makes updates easier
2. **Consistency**: Ensures uniform text across the application
3. **Type Safety**: TypeScript ensures correct usage
4. **i18n Ready**: Structure supports future internationalization
5. **Easy Updates**: Change text without touching components

## Categories

### Authentication (`auth`)

- Login, registration, password reset text
- Form labels and placeholders for auth forms

### Navigation (`nav`)

- Menu items, navigation links
- Breadcrumbs and page titles

### Errors (`errors`)

- Error messages for forms and API responses
- Validation error messages

### Success (`success`)

- Success messages and confirmations
- Flash messages

### Forms (`forms`)

- Form field labels
- Input placeholders
- Helper text

### Buttons (`buttons`)

- Button labels
- Call-to-action text

### UI (`ui`)

- General UI elements
- Dynamic text with parameters
- Helper and explanatory text

### Pages (`pages`)

- Page-specific content
- Section headers and descriptions

## Best Practices

1. **Be specific**: Use descriptive keys that indicate the context
2. **Keep it organized**: Group related texts together
3. **Use functions for dynamic text**: For text that includes variables
4. **Avoid hardcoding**: Never put user-facing text directly in components
5. **Document**: Add comments for complex or context-dependent text

## Future Internationalization

The current structure is designed to be easily extendable for full internationalization:

```typescript
// Future i18n structure
export const texts = {
	en: {
		auth: {
			/* English texts */
		},
		// ... other categories
	},
	de: {
		auth: {
			/* German texts */
		},
		// ... other categories
	},
};
```

This would allow for language switching and localization without major structural changes.
