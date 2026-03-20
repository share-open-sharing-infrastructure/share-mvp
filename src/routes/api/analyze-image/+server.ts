import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const PROMPT = `You are analyzing a photo of a physical item that a person wants to lend to others.

Return ONLY a valid JSON object with exactly two fields:
- "name": a short, clear item name in German (max 6 words, no articles)
- "description": a 1–2 sentence German description suitable for a lending platform, mentioning visible condition, brand if identifiable, and any notable features

Example: {"name":"Bohrmaschine Bosch","description":"Elektrische Bohrmaschine von Bosch in gutem Zustand. Mit Koffer und Aufsätzen."}

Do not include markdown, code fences, or any text outside the JSON object.`;

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Unauthorized' }, { status: 401 });
	}

	let imageBase64: string;
	let mimeType: string;

	try {
		const body = await request.json();
		imageBase64 = body.imageBase64;
		mimeType = body.mimeType;
	} catch {
		return json({ success: false, error: 'Ungültige Anfrage.' }, { status: 400 });
	}

	if (!imageBase64 || !mimeType) {
		return json({ success: false, error: 'Bild oder Dateityp fehlt.' }, { status: 400 });
	}

	const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
	if (!supportedTypes.includes(mimeType)) {
		return json(
			{ success: false, error: `Nicht unterstützter Dateityp: ${mimeType}` },
			{ status: 400 }
		);
	}

	const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

	try {
		const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

		const message = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 256,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							source: {
								type: 'base64',
								media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
								data: rawBase64,
							},
						},
						{
							type: 'text',
							text: PROMPT,
						},
					],
				},
			],
		});

		const rawText =
			message.content[0].type === 'text' ? message.content[0].text.trim() : '';

		// Strip markdown code fences if the model wraps the JSON despite instructions
		const responseText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

		let parsed: { name: string; description: string };
		try {
			parsed = JSON.parse(responseText);
		} catch {
			console.error('Failed to parse model response:', rawText);
			return json(
				{ success: false, error: 'KI-Antwort konnte nicht verarbeitet werden.' },
				{ status: 502 }
			);
		}

		if (!parsed.name || !parsed.description) {
			return json(
				{ success: false, error: 'KI-Antwort unvollständig.' },
				{ status: 502 }
			);
		}

		return json({ success: true, name: parsed.name, description: parsed.description });
	} catch (err) {
		console.error('Anthropic API error:', err);
		return json({ success: false, error: 'KI-Analyse fehlgeschlagen.' }, { status: 502 });
	}
};
