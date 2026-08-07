import { texts } from '$lib/texts';
import { normalizeUsername, validateUsername } from '$lib/utils/username';
import type { UserContact } from '$lib/server/contacts';
import type { GeoPoint } from '$lib/server/geolocation';

/**
 * Field-group parsers for the profile settings form (and the onboarding steps that
 * share its fields), following the itemForm.ts precedent: each function owns one
 * concern, returns either the parsed value or a German validation message, and the
 * route action just sequences them. This keeps /user/profile's saveProfile at
 * orchestration altitude instead of one 200-line function.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** Username: normalize (trim + collapse internal whitespace) and validate against the
 *  shared rules. Empty input means "leave unchanged" → `value: undefined`. */
export function parseUsernameField(formData: FormData): ParseResult<string | undefined> {
	const username = normalizeUsername(formData.get('username')?.toString() ?? '');
	if (username === '') return { ok: true, value: undefined };
	switch (validateUsername(username)) {
		case 'too_short':
			return { ok: false, message: texts.errors.usernameTooShort };
		case 'too_long':
			return { ok: false, message: texts.errors.usernameTooLong };
		case 'invalid':
			return { ok: false, message: texts.errors.usernameInvalidFormat };
	}
	return { ok: true, value: username };
}

/** Messenger handles → the owner-only user_contacts row (not users).
 *  Telegram: strips a leading @, then alphanumeric/underscore, 5-32 chars.
 *  Signal: must be a signal.me link. Empty fields clear the stored handle. */
export function parseMessengerContact(formData: FormData): ParseResult<UserContact> {
	const contact: UserContact = {
		telegramUsername: '',
		signalLink: '',
		telegramVisibleToTrustedOnly: formData.get('telegramVisibleToTrustedOnly') === 'on',
		signalVisibleToTrustedOnly: formData.get('signalVisibleToTrustedOnly') === 'on',
	};

	const telegramUsername = formData.get('telegramUsername')?.toString().trim() ?? '';
	if (telegramUsername !== '') {
		const cleaned = telegramUsername.startsWith('@') ? telegramUsername.slice(1) : telegramUsername;
		if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleaned)) {
			return { ok: false, message: texts.errors.invalidTelegramUsername };
		}
		contact.telegramUsername = cleaned;
	}

	const signalLink = formData.get('signalLink')?.toString().trim() ?? '';
	if (signalLink !== '') {
		if (!signalLink.includes('signal.me')) {
			return { ok: false, message: texts.errors.invalidSignalLink };
		}
		contact.signalLink = signalLink;
	}

	return { ok: true, value: contact };
}

export type OffPlatformContact = {
	contactMethod: '' | 'email' | 'link';
	contactEmail: string;
	contactUrl: string;
	contactPublic: boolean;
};

/** Off-platform-contact opt-in (issue #438) → stored on the `users` record (not
 *  user_contacts). contactMethod ('email' | 'link') turns the item CTA into a mailto:
 *  to contactEmail or a link to contactUrl; '' keeps the in-app flow. contactPublic
 *  exposes the CTA to unauthenticated browsing. Only the ACTIVE method's target is
 *  kept and the other cleared, so no stale off-platform handle lingers on the record
 *  (it would otherwise stay readable by any logged-in viewer of the owner) — and so
 *  validation only ever runs against the field that will actually be used. */
export function parseOffPlatformContact(formData: FormData): ParseResult<OffPlatformContact> {
	const rawMethod = formData.get('contactMethod')?.toString() ?? '';
	const contactMethod = rawMethod === 'email' || rawMethod === 'link' ? rawMethod : '';
	const submittedEmail = (formData.get('contactEmail')?.toString() ?? '').trim();
	const submittedUrl = (formData.get('contactUrl')?.toString() ?? '').trim();
	const contactPublic = contactMethod !== '' && formData.get('contactPublic') === 'on';
	const contactEmail = contactMethod === 'email' ? submittedEmail : '';
	const contactUrl = contactMethod === 'link' ? submittedUrl : '';

	if (contactMethod === 'email') {
		if (contactEmail === '') {
			return { ok: false, message: texts.errors.contactEmailRequired };
		}
		// Practical email shape that also excludes URL-significant characters (?, &, %,
		// quotes, spaces) so the address can't smuggle extra params into the mailto:
		// CTA. PocketBase's email field is the authoritative validator; this is UX + a
		// belt-and-braces guard alongside the per-part encoding in buildMailtoHref().
		if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(contactEmail)) {
			return { ok: false, message: texts.errors.invalidContactEmail };
		}
	}
	if (contactMethod === 'link') {
		if (contactUrl === '') {
			return { ok: false, message: texts.errors.contactUrlRequired };
		}
		// Only https links are allowed. Case-sensitive on purpose: the /api/redirect
		// guard the CTA routes through checks `startsWith('https://')`, so accepting an
		// upper/mixed-case scheme here would store a link that 400s at click time.
		if (!/^https:\/\/[^\s?#]+/.test(contactUrl)) {
			return { ok: false, message: texts.errors.invalidContactUrl };
		}
	}

	return { ok: true, value: { contactMethod, contactEmail, contactUrl, contactPublic } };
}

/** Geolocation fields → the owner-only user_geolocations row.
 *  `undefined` = leave unchanged (no suggestion picked); a point = geocode suggestion
 *  was picked; `null` = clear (the city field was emptied). */
export function parseGeolocationFields(
	formData: FormData,
	city: string | undefined
): GeoPoint | null | undefined {
	const geoLon = formData.get('geolocation_lon')?.toString();
	const geoLat = formData.get('geolocation_lat')?.toString();
	if (geoLon && geoLat) {
		const lon = parseFloat(geoLon);
		const lat = parseFloat(geoLat);
		if (!isNaN(lon) && !isNaN(lat)) return { lon, lat };
		return undefined;
	}
	if (city === '') return null;
	return undefined;
}

/** Preferred transport mode → user_preferences sidecar (issue #426), not users.
 *  Anything but the three known modes means "leave unchanged". */
export function parseTransportMode(formData: FormData): 'foot' | 'bicycle' | 'car' | undefined {
	const raw = formData.get('preferredTransportMode')?.toString();
	return raw === 'foot' || raw === 'bicycle' || raw === 'car' ? raw : undefined;
}
