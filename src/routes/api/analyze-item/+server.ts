import { json, error } from '@sveltejs/kit';
import { MISTRAL_API_KEY } from '$env/static/private';
import { Mistral } from '@mistralai/mistralai';
import { ITEM_CATEGORIES } from '$lib/texts';

const client = new Mistral({ apiKey: MISTRAL_API_KEY });
const imageRecognitionPrompt = `Du bist ein Assistent für eine offene Verleih-Plattform. Analysiere das Bild und erkenne den dargestellten Gegenstand. Antworte NUR mit einem JSON-Objekt ohne Markdown-Formatierung in der folgenden Form:
	{
	"name": "Kurzname auf Deutsch (max. 50 Zeichen)",
	"description": "Einfache Beschreibung auf Deutsch (max. 100 Zeichen)",
	"categories": ["max. 3 Einträge aus: ${ITEM_CATEGORIES.join(', ')}"]
	}`;

// Rate limiting: max 20 requests per user per hour, to prevent abuse of the AI feature. We identify users by their PocketBase user ID, which is stored in locals after authentication. 
// This is a simple in-memory implementation, which means it will reset if the server restarts and won't work across multiple server instances. 
// For a production application, consider using a more robust solution.
const LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export async function POST({ request, locals }) {
	const userId = locals.user!.id;
	const now = Date.now();
	const entry = rateLimits.get(userId);

	if (!entry || now > entry.resetAt) {
		rateLimits.set(userId, { count: 1, resetAt: now + WINDOW_MS });
	} else if (entry.count >= LIMIT) {
		throw error(429, 'Too many requests');
	} else {
		entry.count++;
	}

	const { imageBase64, mimeType } = await request.json();
	if (!imageBase64 || !mimeType) throw error(400, 'Missing image data');

	console.log(imageRecognitionPrompt);
	const response = await client.chat.complete({
		model: 'pixtral-12b-2409',
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'image_url',
						imageUrl: { url: `data:${mimeType};base64,${imageBase64}` },
					},
					{
						type: 'text',
						text: imageRecognitionPrompt,
					},
				],
			},
		],
	});

	const raw = ((response.choices?.[0]?.message?.content as string) ?? '').trim();

	// Strip markdown code fences if the model wraps output in ```json ... ```
	const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

	try {
		const parsed = JSON.parse(cleaned);
		return json({
			name: (parsed.name as string) ?? '',
			description: (parsed.description as string) ?? '',
			categories: (parsed.categories as string[]) ?? [],
		});
	} catch {
		throw error(500, 'Failed to parse AI response');
	}
}
