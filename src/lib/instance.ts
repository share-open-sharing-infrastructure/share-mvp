/**
 * Instanzkonfiguration (Issue #473): EINE Quelle für alles, was sich zwischen AllerLeih-
 * Instanzen unterscheidet (Stadt, Origin, Kontaktadressen, Analytics) — statt verstreuter
 * Literale ("allerleih.org", "Lüneburg") in Routen und Komponenten. `texts.ts` interpoliert
 * daraus die deutschen Copy-Strings (siehe dort); Code liest URLs/E-Mails direkt von hier.
 *
 * Bewusste Ausnahme von der `$env/static/*`-Konvention des Repos: Diese Datei nutzt
 * `$env/dynamic/public`, weil ein einziges Build-Artefakt N Stadt-Instanzen bedienen soll —
 * `adapter-node` liest Umgebungsvariablen zur Laufzeit aus `process.env`, nicht zur Build-Zeit.
 * `$env/static/public` würde die Werte fest in den Build backen (ein Artefakt pro Instanz).
 * Alle anderen 12 `$env/static/*`-Imports im Repo bleiben unverändert – dies ist die einzige
 * Stelle mit `$env/dynamic/public`.
 *
 * Sicherheitshinweise für Wartende:
 * (a) Die Top-Level-Auswertung unten (Modul wird einmal beim ersten Import ausgewertet) ist
 *     unbedenklich, weil SvelteKit `set_public_env()` aufruft, bevor Hooks (`get_hooks()`) und
 *     jedes lazy importierte Routenmodul laufen — die Werte stehen also schon bereit, wenn
 *     dieses Modul zum ersten Mal importiert wird. Bei einem Adapter-Wechsel (weg von
 *     adapter-node) diese Annahme erneut prüfen.
 * (b) `$lib/instance` (und damit `$lib/texts`) darf NIE aus `src/service-worker.ts` importiert
 *     werden — `$env/dynamic/public` ist dort ein Hard-Error (kein Request-Kontext).
 *
 * Nie direkt `throw`en: ein Fehler hier würde die komplette App mit 500 lahmlegen. Ungültige
 * Werte fallen still auf sichere Defaults zurück (siehe `resolveOrigin`/`resolveAnalytics`).
 */
import { env } from '$env/dynamic/public';

export interface InstanceSocial {
	telegram: string;
	mastodon: string;
	pixelfed: string;
	instagram: string;
}

/** Projektweite Links (betreiber-, nicht stadtabhängig — hier nur dedupliziert). */
export interface InstanceLinks {
	github: string;
	contributeBoard: string;
}

/** Postadresse des Betreibers (§5 TMG) — betreiber-, nicht stadtabhängig. */
export interface InstanceImprint {
	operator: string;
	street: string;
	postalCode: string;
	city: string;
	country: string;
}

/** Leere Werte ⇒ Analytics komplett aus (opt-in, kein Fallback auf eine Default-Instanz). */
export interface InstanceAnalytics {
	scriptOrigin: string;
	websiteId: string;
}

export interface InstanceConfig {
	/** Ohne trailing slash. */
	readonly origin: string;
	/** Abgeleitet via `new URL(origin).hostname`. */
	readonly originHost: string;
	readonly city: string;
	readonly appName: string;
	readonly contactEmail: string;
	readonly feedbackEmail: string;
	readonly social: InstanceSocial;
	readonly links: InstanceLinks;
	readonly imprint: InstanceImprint;
	readonly analytics: InstanceAnalytics;
}

const DEFAULT_ORIGIN = 'https://allerleih.org';
const DEFAULT_ORIGIN_HOST = 'allerleih.org';

/**
 * Host+port-Zeichensatz, den jedes hier validierte "vom Betreiber gesetzte Origin" teilt:
 * `[A-Za-z0-9.-]`, optionaler `:port`. Kein eigenständiges Regex — nur der gemeinsame Baustein,
 * aus dem `SITE_ORIGIN_PATTERN`/`SCRIPT_ORIGIN_PATTERN` unten ihre Strings bauen, damit das
 * Injection-Guard-Zeichenset an einer Stelle steht. Der einzige bewusste Unterschied zwischen
 * den beiden (`http:` erlaubt vs. nur `https:`) bleibt an jeder Verwendungsstelle explizit.
 */
const ORIGIN_HOST_PORT = '[A-Za-z0-9.-]+(:\\d+)?';

/**
 * Injection-Guard + Struktur-Guard für `PUBLIC_SITE_ORIGIN`: `new URL(...)` allein reicht nicht
 * (akzeptiert z.B. ein `"` im Host oder einen Pfad, und `.origin`/`.hostname` geben das Rohzeichen
 * unverändert zurück). Dieses enge Muster ist der eigentliche Schutz — geprüft wird der
 * getrimmte Rohwert, bevor überhaupt `new URL()` aufgerufen wird (analog `SCRIPT_ORIGIN_PATTERN`
 * unten). Bewusst `http:` UND `https:` erlaubt (anders als bei Analytics) — eine lokale/LAN-
 * Instanz kann `http://` brauchen. Bewusste Konsequenz: ein Origin mit Pfad/Query/Hash
 * (`https://example.org/sub`) matcht NICHT und fällt auf den Default zurück, statt still
 * gekürzt zu werden — ein Base-Path-Deployment ist Sache von `config.kit.paths.base`, nicht
 * dieser Origin-Konfiguration (und `instanceUrl()` selbst nimmt nur root-absolute Pfade, nie
 * `resolve()`-Ausgabe — siehe die Doku dort).
 */
const SITE_ORIGIN_PATTERN = new RegExp(`^https?://${ORIGIN_HOST_PORT}$`);

/**
 * Strippt trailing slashes und validiert gegen `SITE_ORIGIN_PATTERN`. Ungültige/leere Werte
 * fallen auf den Default zurück statt zu werfen — ein kaputter `PUBLIC_SITE_ORIGIN` darf die App
 * nicht 500en. `new URL()` dient hier nur noch der Normalisierung (z.B. Groß-/Kleinschreibung im
 * Host; ein abschließender Punkt in einem FQDN bleibt erhalten), nicht dem Schutz selbst — das
 * leistet allein das Muster oben. Exportiert, damit Tests die reine Validierungslogik direkt
 * aufrufen können, statt sie nur über `vi.resetModules()` + dynamischen Re-Import des Singletons
 * zu erreichen.
 */
export function resolveOrigin(raw: string | undefined): { origin: string; originHost: string } {
	const candidate = (raw ?? '').trim().replace(/\/+$/, '');
	if (candidate && SITE_ORIGIN_PATTERN.test(candidate)) {
		try {
			const url = new URL(candidate);
			return { origin: url.origin, originHost: url.hostname };
		} catch {
			// SITE_ORIGIN_PATTERN sollte das schon ausschließen — fällt unten auf den Default zurück
		}
	}
	return { origin: DEFAULT_ORIGIN, originHost: DEFAULT_ORIGIN_HOST };
}

/** `websiteId` ist eine Umami-UUID/Slug — hier bewusst eng gefasst (Injection-Guard). */
const WEBSITE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/**
 * Injection-Guard für `scriptOrigin`: `new URL(...).origin` reicht dafür ALLEIN nicht aus —
 * `new URL()` akzeptiert z.B. ein `"` im Host und `.origin` gibt es unverändert zurück
 * (`new URL('https://x"onload=alert(1)').origin === 'https://x"onload=alert(1)'`), was aus dem
 * `src="${scriptOrigin}/script.js"`-Attribut im Snippet ausbrechen würde. Dieses enge Muster ist
 * der eigentliche Schutz: nur `https:` (anders als `SITE_ORIGIN_PATTERN` oben — Analytics hat
 * keinen http-Ausnahmefall), Host-Zeichen via `ORIGIN_HOST_PORT` auf `[A-Za-z0-9.-]` beschränkt,
 * optionaler `:port` (z.B. für eine selbstgehostete Analytics-Instanz auf localhost während des
 * Setups).
 */
const SCRIPT_ORIGIN_PATTERN = new RegExp(`^https://${ORIGIN_HOST_PORT}$`);

/**
 * Analytics ist opt-in ohne Fallback: nur wenn BEIDE Variablen gesetzt und gültig sind, wird
 * `analyticsHeadSnippet()` etwas ausgeben. `scriptOrigin` muss dem engen Muster oben entsprechen
 * (die Snippet-Ausgabe landet ungeschützt im HTML), `websiteId` muss `WEBSITE_ID_PATTERN`
 * entsprechen. Exportiert (siehe `resolveOrigin`) für direkte Tests der reinen Validierung.
 */
export function resolveAnalytics(
	rawScriptOrigin: string | undefined,
	rawWebsiteId: string | undefined
): InstanceAnalytics {
	const off: InstanceAnalytics = { scriptOrigin: '', websiteId: '' };

	const scriptOrigin = (rawScriptOrigin ?? '').trim().replace(/\/+$/, '');
	const websiteId = (rawWebsiteId ?? '').trim();
	if (!scriptOrigin || !websiteId) return off;
	if (!WEBSITE_ID_PATTERN.test(websiteId)) return off;
	if (!SCRIPT_ORIGIN_PATTERN.test(scriptOrigin)) return off;

	try {
		// Normalisiert (z.B. IDN-Hosts) statt des rohen Kandidaten zurückzugeben — das obige
		// Muster ist der Guard, `url.origin` hier ist nur Normalisierung, kein zusätzlicher Schutz.
		const url = new URL(scriptOrigin);
		return { scriptOrigin: url.origin, websiteId };
	} catch {
		return off;
	}
}

const { origin, originHost } = resolveOrigin(env.PUBLIC_SITE_ORIGIN);

export const instance: InstanceConfig = {
	origin,
	originHost,
	city: env.PUBLIC_INSTANCE_CITY?.trim() || 'Lüneburg',
	// Partiell (Issue #473-Entscheidung): benennt nur diesen Wert um, schreibt weder die
	// ~89 "AllerLeih"-Vorkommen in der deutschen Copy noch die Bild-Assets (Logo, Icons) um.
	appName: env.PUBLIC_APP_NAME?.trim() || 'AllerLeih',
	contactEmail: env.PUBLIC_CONTACT_EMAIL?.trim() || 'kontakt@allerleih.org',
	// Betreiber-Adresse, nicht stadtabhängig — daher hier hart hinterlegt statt env-gespeist.
	feedbackEmail: 'feedback@allerleih.org',
	social: {
		telegram: 'https://t.me/allerleih_org',
		mastodon: 'https://norden.social/@AllerLeih',
		pixelfed: 'https://pixelfed.de/AllerLeih',
		instagram: 'https://www.instagram.com/aller.leih/',
	},
	links: {
		github: 'https://github.com/share-open-sharing-infrastructure/share-mvp',
		contributeBoard:
			'https://allerleih.notion.site/36de086dc6ab80f69529e6cf68afe7c4?v=36de086dc6ab80869c89000c98bbac63',
	},
	imprint: {
		operator: 'Matteo Ramin',
		street: 'Lüner Weg 17',
		postalCode: '21337',
		city: 'Lüneburg',
		country: 'Deutschland',
	},
	analytics: resolveAnalytics(env.PUBLIC_ANALYTICS_ORIGIN, env.PUBLIC_ANALYTICS_WEBSITE_ID),
};

/**
 * Absolute, crawler-taugliche URL aus einem root-absoluten Pfad (z.B. `'/misc/imprint'`).
 *
 * NIE mit `resolve()` (`$app/paths`) komponieren: `svelte.config.js` hat keinen `paths`-Block,
 * also gilt SvelteKits Default `paths.relative: true`, und `resolve()` liefert unter SSR einen
 * **seitenrelativen** Pfad zurück (`'./'` für `/`, `'../misc/imprint'` für eine verschachtelte
 * Route) — `instanceUrl(resolve(...))` erzeugte dadurch kaputte `canonical`/`og:url`-Tags im
 * server-gerenderten HTML (`https://allerleih.org../misc/imprint`), obwohl es im Browser nach
 * der Hydration korrekt aussah (Issue #473, Runde 4). Immer einen literalen root-absoluten Pfad
 * übergeben (oder `page.url.pathname` aus `$app/state`, siehe `SeoHead.svelte`).
 *
 * Der DEV-Guard unten macht einen Verstoß laut statt still falsch — kein `throw`, weil ein
 * Render-Fehler hier schlimmer wäre als ein falsches Tag.
 */
export function instanceUrl(path: string): string {
	if (import.meta.env.DEV && !path.startsWith('/')) {
		console.error(
			`instanceUrl() erwartet einen root-absoluten Pfad, bekam "${path}" — vermutlich ` +
				'resolve()-Ausgabe direkt mit einem Origin verkettet (siehe Kommentar oben).'
		);
	}
	return `${instance.origin}${path}`;
}

/**
 * `<head>`-Snippet für Umami; `''` wenn Analytics nicht/ungültig konfiguriert ist (siehe
 * `resolveAnalytics`). Bei gesetzten Produktionswerten byte-identisch zum bisherigen
 * `src/app.html:13-14`. Reiner Formatter, getrennt von `analyticsHeadSnippet()`, damit Tests
 * die `resolveAnalytics()` → Snippet-Pipeline direkt aufrufen können, ohne `vi.resetModules()` +
 * `vi.doMock()` + dynamischen Re-Import, um Env-Vars in das Modul-Singleton zu injizieren.
 *
 * Re-validiert `scriptOrigin`/`websiteId` gegen dieselben Muster wie `resolveAnalytics`, statt
 * dem Aufrufer zu vertrauen: `InstanceAnalytics` ist ein reiner Daten-Typ (keine Brand/Nominal-
 * Typisierung), jeder Aufrufer hier reicht bereits validierte Werte durch, aber die Signatur
 * allein erzwingt das nicht — die Prüfung ist billig und idempotent, also lieber hier nochmal.
 */
export function buildAnalyticsSnippet(analytics: InstanceAnalytics): string {
	if (!analytics.scriptOrigin || !analytics.websiteId) return '';
	if (!SCRIPT_ORIGIN_PATTERN.test(analytics.scriptOrigin)) return '';
	if (!WEBSITE_ID_PATTERN.test(analytics.websiteId)) return '';
	const { scriptOrigin, websiteId } = analytics;
	return (
		`<script defer src="${scriptOrigin}/script.js" data-website-id="${websiteId}"></script>\n` +
		`<script defer src="${scriptOrigin}/recorder.js" data-website-id="${websiteId}"></script>`
	);
}

/** Wie {@link buildAnalyticsSnippet}, gebunden an den Modul-Singleton `instance.analytics`. */
export function analyticsHeadSnippet(): string {
	return buildAnalyticsSnippet(instance.analytics);
}
