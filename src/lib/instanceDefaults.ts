/**
 * The flagship instance's (allerleih.org) OWN operator data — city, contact address,
 * social/project links, the §5 TMG imprint, the feedback address, the founder-bio FAQ sentence,
 * and the "/misc/about" team roster. Split out of `$lib/instance.ts` by #629 for two reasons:
 *
 * 1. Setting up a NEW instance: this is the one file you read to see exactly what belongs to
 *    the flagship and would need to be replaced — everything else in `instance.ts` is either
 *    generic resolution logic or env-driven.
 * 2. File length: `instance.ts` was creeping toward the `code-quality-reviewer`'s 400-line
 *    blocking threshold; these literals carried none of the module's actual logic.
 *
 * These are FLAGSHIP DEFAULTS, not global defaults — `instance.ts` only falls back to them when
 * `FLAGSHIP` is true (see `isFlagshipOrigin()` in `$lib/instanceResolvers.ts`). A non-flagship
 * instance without the matching env var gets `''` (or, for a Class A field, never reaches this
 * point at all — the server refuses to start; see `$lib/server/env.ts`'s `missingInstanceEnv()`).
 * The one exception is `UPSTREAM_REPO` below (Class C): it defaults unconditionally on every
 * instance, flagship or not — it lives here anyway because it's still the AllerLeih project's
 * own data, just not gated the way the rest of this file is.
 *
 * No env access in this file — it exports plain literals only. Reading env vars stays
 * `instance.ts`'s job (module-scope env reads live in exactly one place, per its own header
 * comment).
 */

/** The flagship's own *browsing* city (search headings, SEO copy) — a separate concept from
 *  `FLAGSHIP_IMPRINT.city` below (the §5 TMG postal address), even though both happen to be
 *  "Lüneburg" for the flagship. */
export const FLAGSHIP_CITY = 'Lüneburg';

export const FLAGSHIP_CONTACT_EMAIL = 'kontakt@allerleih.org';

/** §5 TMG imprint fields that are real operator data (as opposed to `instance.ts`'s generic,
 *  non-flagship-specific `legal.*` placeholder guidance, which lives there unconditionally). */
export const FLAGSHIP_IMPRINT = {
	operator: 'AllerLeih e.V.',
	representative: 'Vertreten durch Matteo Ramin und Timo Johner',
	street: 'Lüner Weg 17',
	postalCode: '21337',
	city: 'Lüneburg',
	country: 'Deutschland',
	registerEntry: 'Vereinsregisternummer: VR 202438 (Amtsgericht Lüneburg).',
};

export const FLAGSHIP_SOCIAL = {
	telegram: 'https://t.me/allerleih_org',
	mastodon: 'https://norden.social/@AllerLeih',
	pixelfed: 'https://pixelfed.de/AllerLeih',
	instagram: 'https://www.instagram.com/aller.leih/',
};

export const FLAGSHIP_CONTRIBUTE_URL =
	'https://allerleih.notion.site/36de086dc6ab80f69529e6cf68afe7c4?v=36de086dc6ab80869c89000c98bbac63';

export const FLAGSHIP_FEEDBACK_EMAIL = 'feedback@allerleih.org';

/**
 * The AllerLeih project's own upstream repository — Class C (see `instance.ts`'s header
 * comment): defaults unconditionally, flagship or not, and stays overridable via
 * `PUBLIC_GITHUB_URL` for a fork that wants its own "view on GitHub" target.
 */
export const UPSTREAM_REPO = 'https://github.com/share-open-sharing-infrastructure/share-mvp';

/**
 * The operator-specific opening of FAQ item 1 ("Wer seid ihr?") — biographical, names the
 * flagship's actual legal form and current team, so it's flagship-only (never CITY/APP_NAME
 * interpolated: it's true regardless of which city currently runs allerleih.org). The rest of
 * that FAQ answer (the values paragraph) is instance-neutral and lives directly in
 * `instance.ts`, prefixed with this on the flagship only.
 */
export const FLAGSHIP_FOUNDER_INTRO =
	'Wir sind der AllerLeih e.V. aus Lüneburg und wollen mit dieser Plattform einen Beitrag zum Gemeinwohl leisten. Im Team sind aktuell Timo, Rocho, Falk, Julia, Madita, Christian und Matteo.';

export const FLAGSHIP_TEAM = [
	{
		id: 1,
		linkedIn: 'https://www.linkedin.com/in/matteo-ramin/',
		gitHub: 'https://github.com/MaRaMinden',
		src: 'https://avatars.githubusercontent.com/u/7858896?v=4',
		alt: 'Matteo Ramin',
		name: 'Matteo Ramin',
		jobTitle: 'Initiator & Koordinator',
		description: 'Macht irgendwie alles son bisschen!',
	},
	{
		id: 2,
		linkedIn: 'https://www.linkedin.com/in/timo-johner',
		gitHub: 'https://github.com/timojohlo',
		src: 'https://avatars.githubusercontent.com/u/32620814?v=4',
		alt: 'Timo Johner',
		name: 'Timo Johner',
		jobTitle: 'Initiator & Technik-Guru',
		description: 'Ohne den läuft hier kein Server.',
	},
];
