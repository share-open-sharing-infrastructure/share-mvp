/**
 * Scenario: off-platform contact (issue #438).
 *
 * Owners can opt out of the in-app request flow and offer an alternative contact channel,
 * with two independent dimensions — the METHOD (email vs external link) and the VISIBILITY
 * (public, i.e. also for logged-out visitors, vs logged-in only):
 *
 *  - verleih_seed — institution, contactMethod = 'email', contactPublic = TRUE. Its public
 *    items show an "Anfragen" button that opens a prefilled mailto:, visible even WITHOUT
 *    login. Its trustees-only item stays masked and shows NO contact (privacy gate).
 *  - formular_seed — institution, contactMethod = 'link', contactPublic = TRUE. Its item's
 *    "Anfragen" button links to an external lending form (via /api/redirect), also visible
 *    logged-out.
 *  - intern_seed — owner, contactMethod = 'email', contactPublic = FALSE (members-only).
 *    The mailto CTA shows only to logged-in viewers; logged-out visitors see the normal
 *    (login-gated) request affordance.
 *  - normalo_seed — ordinary owner WITHOUT off-platform contact → normal in-app
 *    "Anfragen" → conversation flow, for side-by-side comparison.
 *  - lina_seed is the viewer/requester. She is NOT trusted by any of the owners.
 */
import { createUser, createItem, USER_PASSWORD, SEED_DOMAIN } from '../lib.js';

export const description =
	'Off-platform contact (#438): email/link contact CTAs, public vs members-only, vs a normal owner.';

const CONTACT_EMAIL = 'verleih@asta-lueneburg.seed.test';
const INTERN_EMAIL = 'intern@asta-lueneburg.seed.test';
const FORM_URL = 'https://www.janun-lueneburg.de/de/service/materialverleih-lg-neu/';

export async function run(pb) {
	const verleih = await createUser(pb, 'verleih_seed', {
		isInstitution: true,
		bio: 'Verleih der Studierendenvertretung – Abholung vor Ort, Anfragen bitte per E-Mail.',
		contactMethod: 'email',
		contactEmail: CONTACT_EMAIL,
		contactPublic: true,
	});
	const formular = await createUser(pb, 'formular_seed', {
		isInstitution: true,
		bio: 'Materialverleih über unser eigenes Online-Formular.',
		contactMethod: 'link',
		contactUrl: FORM_URL,
		contactPublic: true,
	});
	const intern = await createUser(pb, 'intern_seed', {
		contactMethod: 'email',
		contactEmail: INTERN_EMAIL,
		contactPublic: false,
	});
	const normalo = await createUser(pb, 'normalo_seed');
	await createUser(pb, 'lina_seed'); // viewer/requester — referenced by login name only

	const werkbank = await createItem(pb, verleih.id, 'Werkbank', ['Werkzeug und Garten']);
	const printer = await createItem(pb, verleih.id, '3D-Drucker', ['Werkzeug und Garten'], {
		trusteesOnly: true,
	});
	const beamer = await createItem(pb, formular.id, 'Beamer', ['Multimedia']);
	const zelt = await createItem(pb, intern.id, 'Zelt', ['Freizeit']);
	const bohrer = await createItem(pb, normalo.id, 'Akkuschrauber', ['Werkzeug und Garten']);

	return `  Login (password for all: "${USER_PASSWORD}"):
    verleih_seed${SEED_DOMAIN}  (E-Mail-Kontakt, ÖFFENTLICH, ${CONTACT_EMAIL})
    formular_seed${SEED_DOMAIN} (Link-Kontakt, ÖFFENTLICH, externes Formular)
    intern_seed${SEED_DOMAIN}   (E-Mail-Kontakt, NUR EINGELOGGT, ${INTERN_EMAIL})
    normalo_seed${SEED_DOMAIN}  (normaler Owner, kein Off-Platform-Kontakt)
    lina_seed${SEED_DOMAIN}     (Betrachterin, NICHT vertraut)

  Items:
    Werkbank (öffentlich, verleih)      → /items/${werkbank.id}
    3D-Drucker (trustees-only, verleih) → /items/${printer.id}
    Beamer (öffentlich, formular)       → /items/${beamer.id}
    Zelt (öffentlich, intern)           → /items/${zelt.id}
    Akkuschrauber (normalo)             → /items/${bohrer.id}

  Walkthrough:
    1. AUSGELOGGT die Werkbank öffnen → "Anfragen" öffnet eine vorausgefüllte E-Mail an
       ${CONTACT_EMAIL} (contactPublic=true → auch ohne Login sichtbar).
    2. AUSGELOGGT den Beamer öffnen → "Anfragen" führt über /api/redirect zum externen
       Verleih-Formular (neuer Tab).
    3. AUSGELOGGT das Zelt öffnen → KEIN Mailto sichtbar (members-only); erst als lina
       einloggen → "Anfragen" öffnet die E-Mail an ${INTERN_EMAIL}.
    4. Als lina den Akkuschrauber öffnen → "Anfragen" startet wie gewohnt eine In-App-
       Konversation (Vergleich: regulärer Flow unverändert).
    5. Als lina den 3D-Drucker öffnen → maskiert, "Anfragen" deaktiviert (Tooltip),
       KEINE E-Mail sichtbar (Privacy-Gate für trustees-only Items, auch bei contactPublic).
    6. Als verleih einloggen → /user/profile → Sektion "Kontakt außerhalb der Plattform":
       Kontaktweg = E-Mail, Adresse gefüllt, "Auch ohne Login sichtbar" AN. Adresse leeren
       + Speichern → Fehlermeldung. Kontaktweg = Link ohne URL → Fehlermeldung. http://-URL
       → Fehlermeldung.`;
}
