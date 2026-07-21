import { describe, it, expect } from 'vitest';
import { linkifySegments, type DescriptionSegment } from './linkify';

const link = (url: string): DescriptionSegment => ({ type: 'link', url });
const text = (t: string): DescriptionSegment => ({ type: 'text', text: t });

describe('linkifySegments', () => {
	it('returns a single text segment when there is no link', () => {
		expect(linkifySegments('Nur ganz normaler Text ohne Link.')).toEqual([
			text('Nur ganz normaler Text ohne Link.'),
		]);
	});

	it('returns a single link segment for a bare URL', () => {
		expect(linkifySegments('https://example.com/anleitung')).toEqual([
			link('https://example.com/anleitung'),
		]);
	});

	it('handles a link at the very start', () => {
		expect(linkifySegments('https://example.com ist die Quelle')).toEqual([
			link('https://example.com'),
			text(' ist die Quelle'),
		]);
	});

	it('handles a link at the very end', () => {
		expect(linkifySegments('Mehr dazu unter https://example.com/x')).toEqual([
			text('Mehr dazu unter '),
			link('https://example.com/x'),
		]);
	});

	it('handles multiple links with text in between', () => {
		expect(
			linkifySegments('Erst https://a.de dann https://b.de/pfad fertig')
		).toEqual([
			text('Erst '),
			link('https://a.de'),
			text(' dann '),
			link('https://b.de/pfad'),
			text(' fertig'),
		]);
	});

	it('strips a trailing period off the URL and keeps it as text', () => {
		expect(linkifySegments('Siehe https://x.de/a.')).toEqual([
			text('Siehe '),
			link('https://x.de/a'),
			text('.'),
		]);
	});

	it('strips a run of trailing punctuation', () => {
		expect(linkifySegments('Wirklich? https://x.de/a?!')).toEqual([
			text('Wirklich? '),
			link('https://x.de/a'),
			text('?!'),
		]);
	});

	it('treats a closing paren wrapping the URL as text', () => {
		expect(
			linkifySegments('(siehe https://de.wikipedia.org/wiki/Bohrmaschine)')
		).toEqual([
			text('(siehe '),
			link('https://de.wikipedia.org/wiki/Bohrmaschine'),
			text(')'),
		]);
	});

	it('keeps a closing paren that balances an opening paren inside the URL', () => {
		expect(
			linkifySegments('https://de.wikipedia.org/wiki/Bohrmaschine_(Werkzeug)')
		).toEqual([link('https://de.wikipedia.org/wiki/Bohrmaschine_(Werkzeug)')]);
	});

	it('keeps the balanced paren but strips a following period', () => {
		expect(
			linkifySegments('https://en.wikipedia.org/wiki/Drill_(tool).')
		).toEqual([link('https://en.wikipedia.org/wiki/Drill_(tool)'), text('.')]);
	});

	it('matches an uppercase scheme without normalizing the URL', () => {
		expect(linkifySegments('HTTPS://EXAMPLE.COM/A')).toEqual([
			link('HTTPS://EXAMPLE.COM/A'),
		]);
	});

	it('does not linkify javascript: URLs', () => {
		expect(linkifySegments('javascript:alert(1)')).toEqual([
			text('javascript:alert(1)'),
		]);
	});

	it('does not linkify data: URLs', () => {
		expect(linkifySegments('data:text/html,<script>x</script>')).toEqual([
			text('data:text/html,<script>x</script>'),
		]);
	});

	it('does not linkify scheme-less www. addresses', () => {
		expect(linkifySegments('Besuche www.example.de bitte')).toEqual([
			text('Besuche www.example.de bitte'),
		]);
	});

	it('does not linkify ftp:// URLs', () => {
		expect(linkifySegments('ftp://files.example.de/x')).toEqual([
			text('ftp://files.example.de/x'),
		]);
	});

	it('preserves umlauts and special characters in surrounding text', () => {
		expect(linkifySegments('Schöne Grüße – hier: https://x.de/ä')).toEqual([
			text('Schöne Grüße – hier: '),
			link('https://x.de/ä'),
		]);
	});

	it('preserves newlines in text segments around a link', () => {
		expect(
			linkifySegments(
				'Zeile eins\nZeile zwei\nMehr unter https://example.com/x'
			)
		).toEqual([
			text('Zeile eins\nZeile zwei\nMehr unter '),
			link('https://example.com/x'),
		]);
	});

	it('keeps a pure multiline text as one text segment', () => {
		expect(linkifySegments('Zeile eins\nZeile zwei')).toEqual([
			text('Zeile eins\nZeile zwei'),
		]);
	});
});
