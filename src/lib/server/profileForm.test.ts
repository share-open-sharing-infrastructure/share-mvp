import { describe, it, expect } from 'vitest';
import { texts } from '$lib/texts';
import {
	parseUsernameField,
	parseMessengerContact,
	parseOffPlatformContact,
	parseGeolocationFields,
	parseTransportMode,
} from './profileForm';

function fd(entries: Record<string, string>): FormData {
	const formData = new FormData();
	for (const [k, v] of Object.entries(entries)) formData.set(k, v);
	return formData;
}

describe('parseUsernameField', () => {
	it('treats an empty username as "leave unchanged"', () => {
		expect(parseUsernameField(fd({}))).toEqual({ ok: true, value: undefined });
	});

	it('normalizes surrounding whitespace', () => {
		expect(parseUsernameField(fd({ username: '  Anna Beispiel  ' }))).toEqual({
			ok: true,
			value: 'Anna Beispiel',
		});
	});

	it('rejects a too-short username with the German message', () => {
		expect(parseUsernameField(fd({ username: 'ab' }))).toEqual({
			ok: false,
			message: texts.errors.usernameTooShort,
		});
	});
});

describe('parseMessengerContact', () => {
	it('strips a leading @ from a valid Telegram handle', () => {
		const result = parseMessengerContact(fd({ telegramUsername: '@anna_teilt' }));
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('unreachable');
		expect(result.value.telegramUsername).toBe('anna_teilt');
	});

	it('rejects an invalid Telegram handle', () => {
		expect(parseMessengerContact(fd({ telegramUsername: 'a!' }))).toEqual({
			ok: false,
			message: texts.errors.invalidTelegramUsername,
		});
	});

	it('rejects a Signal link that is not a signal.me link', () => {
		expect(parseMessengerContact(fd({ signalLink: 'https://example.com/x' }))).toEqual({
			ok: false,
			message: texts.errors.invalidSignalLink,
		});
	});

	it('maps the visibility toggles and clears absent handles', () => {
		const result = parseMessengerContact(fd({ telegramVisibleToTrustedOnly: 'on' }));
		expect(result).toEqual({
			ok: true,
			value: {
				telegramUsername: '',
				signalLink: '',
				telegramVisibleToTrustedOnly: true,
				signalVisibleToTrustedOnly: false,
			},
		});
	});
});

describe('parseOffPlatformContact', () => {
	it('keeps only the active method target and clears the other', () => {
		const result = parseOffPlatformContact(
			fd({
				contactMethod: 'email',
				contactEmail: 'anna@example.org',
				contactUrl: 'https://stale.example.org',
				contactPublic: 'on',
			})
		);
		expect(result).toEqual({
			ok: true,
			value: {
				contactMethod: 'email',
				contactEmail: 'anna@example.org',
				contactUrl: '',
				contactPublic: true,
			},
		});
	});

	it('requires the email when the email method is chosen', () => {
		expect(parseOffPlatformContact(fd({ contactMethod: 'email' }))).toEqual({
			ok: false,
			message: texts.errors.contactEmailRequired,
		});
	});

	it('rejects a non-https contact link', () => {
		expect(
			parseOffPlatformContact(fd({ contactMethod: 'link', contactUrl: 'http://example.org' }))
		).toEqual({ ok: false, message: texts.errors.invalidContactUrl });
	});

	it('an unknown method disables off-platform contact (and contactPublic with it)', () => {
		expect(parseOffPlatformContact(fd({ contactMethod: 'phone', contactPublic: 'on' }))).toEqual({
			ok: true,
			value: { contactMethod: '', contactEmail: '', contactUrl: '', contactPublic: false },
		});
	});
});

describe('parseGeolocationFields', () => {
	it('returns the picked point when both coordinates are present', () => {
		expect(parseGeolocationFields(fd({ geolocation_lon: '9.99', geolocation_lat: '53.55' }), 'HH')).toEqual(
			{ lon: 9.99, lat: 53.55 }
		);
	});

	it('returns null (clear) when the city was emptied', () => {
		expect(parseGeolocationFields(fd({}), '')).toBeNull();
	});

	it('returns undefined (leave unchanged) when nothing was picked and city is set', () => {
		expect(parseGeolocationFields(fd({}), 'Hamburg')).toBeUndefined();
	});
});

describe('parseTransportMode', () => {
	it('accepts the three known modes', () => {
		expect(parseTransportMode(fd({ preferredTransportMode: 'car' }))).toBe('car');
	});

	it('treats anything else as "leave unchanged"', () => {
		expect(parseTransportMode(fd({ preferredTransportMode: 'rocket' }))).toBeUndefined();
	});
});
