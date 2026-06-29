/**
 * Scenario: contact via mail (issue #438).
 *
 *  - verleih_seed is an institution that handles lending OFF-platform: it has
 *    contactViaEmail = true + a contactEmail. Its items show a "Anfragen" button that
 *    opens a prefilled mailto: instead of starting the in-app request flow.
 *      · "Werkbank" — public item → any logged-in viewer sees the mailto CTA.
 *      · "3D-Drucker" — trustees-only → a non-trusted viewer sees it MASKED with the
 *        disabled tooltip and NO mailto (privacy gate: the address must not leak there).
 *  - normalo_seed is an ordinary owner WITHOUT email contact → its item keeps the normal
 *    in-app "Anfragen" → conversation flow, for side-by-side comparison.
 *  - lina_seed is the viewer/requester. She is NOT trusted by verleih_seed.
 */
import { createUser, createItem, USER_PASSWORD, SEED_DOMAIN } from '../lib.js';

export const description =
	'Contact via mail (#438): an email-contact institution whose items open a mailto: CTA, vs a normal owner.';

const CONTACT_EMAIL = 'verleih@asta-lueneburg.seed.test';

export async function run(pb) {
	const verleih = await createUser(pb, 'verleih_seed', {
		isInstitution: true,
		bio: 'Verleih der Studierendenvertretung – Abholung vor Ort, Anfragen bitte per E-Mail.',
		contactViaEmail: true,
		contactEmail: CONTACT_EMAIL,
	});
	const normalo = await createUser(pb, 'normalo_seed');
	const lina = await createUser(pb, 'lina_seed');

	const werkbank = await createItem(pb, verleih.id, 'Werkbank', ['Werkzeug und Garten']);
	const printer = await createItem(pb, verleih.id, '3D-Drucker', ['Werkzeug und Garten'], {
		trusteesOnly: true,
	});
	const bohrer = await createItem(pb, normalo.id, 'Akkuschrauber', ['Werkzeug und Garten']);

	return `  Login (password for all: "${USER_PASSWORD}"):
    verleih_seed${SEED_DOMAIN} (E-Mail-Kontakt AN, ${CONTACT_EMAIL})
    normalo_seed${SEED_DOMAIN} (normaler Owner, kein E-Mail-Kontakt)
    lina_seed${SEED_DOMAIN} (Betrachterin, NICHT vertraut)

  Items:
    Werkbank (öffentlich, verleih)   → /items/${werkbank.id}
    3D-Drucker (trustees-only, verleih) → /items/${printer.id}
    Akkuschrauber (normalo)          → /items/${bohrer.id}

  Walkthrough:
    1. Als lina einloggen → Werkbank öffnen → "Anfragen" öffnet eine vorausgefüllte
       E-Mail an ${CONTACT_EMAIL} (kein Chat, kein /conversations-Redirect).
    2. Als lina den Akkuschrauber öffnen → "Anfragen" startet wie gewohnt eine In-App-
       Konversation (Vergleich: regulärer Flow unverändert).
    3. Als lina den 3D-Drucker öffnen → maskiert, "Anfragen" deaktiviert (Tooltip),
       KEINE E-Mail sichtbar (Privacy-Gate für trustees-only Items).
    4. Als verleih einloggen → /user/profile → Sektion "Kontakt per E-Mail": Toggle ist
       AN, Adresse gefüllt. Toggle AN lassen + Adresse leeren + Speichern → Fehlermeldung.
       Ungültige Adresse → Fehlermeldung. Gültige Adresse → gespeichert.`;
}
