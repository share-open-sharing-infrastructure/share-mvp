import { describe, it, expect } from 'vitest';
import { assertPublicHttpUrl } from './urlGuard';

describe('assertPublicHttpUrl', () => {
	it.each([
		'https://allerlei.uber.space',
		'https://rblg.stadt.lueneburg.de/webopac',
		'https://leih.example.org:8443/base',
	])('accepts the public https URL %s', (url) => {
		expect(() => assertPublicHttpUrl(url)).not.toThrow();
	});

	it.each([
		['http://leih.example.org', /https:/],
		['ftp://leih.example.org', /https:/],
		['not a url', /Invalid/],
		['https://localhost', /private\/loopback/],
		['https://foo.localhost', /private\/loopback/],
		['https://pb.local', /private\/loopback/],
		['https://127.0.0.1:8090', /private\/loopback/],
		['https://10.1.2.3', /private\/loopback/],
		['https://172.16.0.1', /private\/loopback/],
		['https://172.31.255.255', /private\/loopback/],
		['https://192.168.1.10', /private\/loopback/],
		['https://169.254.169.254', /private\/loopback/], // cloud metadata endpoint
		['https://[::1]', /private\/loopback/],
		['https://[fe80::1]', /private\/loopback/],
		['https://[fd00::2]', /private\/loopback/],
		['https://[::ffff:127.0.0.1]', /private\/loopback/],
	])('rejects %s', (url, message) => {
		expect(() => assertPublicHttpUrl(url)).toThrow(message);
	});

	it('does not flag public hosts that merely contain private-looking octets', () => {
		expect(() => assertPublicHttpUrl('https://172.32.0.1')).not.toThrow(); // outside 172.16/12
		expect(() => assertPublicHttpUrl('https://11.0.0.1')).not.toThrow();
	});

	it('skips all checks with allowInsecure (dev)', () => {
		expect(() => assertPublicHttpUrl('http://localhost:8090', { allowInsecure: true })).not.toThrow();
	});
});
