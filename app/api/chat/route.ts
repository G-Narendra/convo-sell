import { google } from '@ai-sdk/google';
import { streamText, createUIMessageStreamResponse, convertToModelMessages } from 'ai';
import { detectInjection, sanitizeInput, validateOutput } from '@/app/lib/guardrails';

export const maxDuration = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Simple in-memory rate limiter (resets on server restart — suitable for demo)
// Limits each IP to 20 requests per 60-second window.
// ─────────────────────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment before sending another message.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { messages: any[]; data?: any };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { messages, data } = body;
  const isVoiceMode = data?.mode === 'voice';

  // ── Server-side injection detection ───────────────────────────────────────
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No messages provided.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // SDK v6 sends UIMessage (parts array). Extract text for guardrail checks.
  for (const msg of messages) {
    if (msg.role === 'user') {
      // UIMessage format: text lives in parts[].text
      const rawText: string = Array.isArray(msg.parts)
        ? msg.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text ?? '')
            .join('')
        : (typeof msg.content === 'string' ? msg.content : '');

      const sanitized = sanitizeInput(rawText);
      const check = detectInjection(sanitized);
      if (!check.safe) {
        return new Response(
          JSON.stringify({ error: check.reason }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // Convert UIMessage[] → ModelMessage[] that streamText understands
  const modelMessages = await convertToModelMessages(messages);

  // ── Upsell history block ───────────────────────────────────────────────────
  const upsellHistoryBlock =
    data?.upsellHistory?.length > 0
      ? `\nUPSELL HISTORY FOR THIS SESSION (use to personalise suggestions):
${(data.upsellHistory as { item: string; accepted: boolean }[])
  .map(
    (u) =>
      `- "${u.item}": ${
        u.accepted
          ? 'ACCEPTED ✓ (they liked this — do NOT resurface unless directly relevant)'
          : 'DECLINED ✗ (do NOT suggest again this session)'
      }`
  )
  .join('\n')}
`
      : '';

  // ── System prompt (with hardened security section) ─────────────────────────
  const systemPrompt = `You are ConvoSell AI, the digital host for "Global Hub @ MDX", a vibrant multi-cultural restaurant located at Middlesex University Dubai.
Your audience consists of university students from diverse global backgrounds looking for quick bites, comforting meals between classes, or study fuel.

YOUR PRIMARY GOALS:
1. INFLUENCER IDENTITY: You are a persuasive sales mastermind. Maximize "Total Basket Value".
2. THE PIVOT: Use empathy to bond, then pivot to a sale. "Biryani is a warm hug—you NEED this."
3. RESIST CANCELLATIONS: If they try to remove items, use FOMO or Value Bonding to save the sale.
4. MANDATORY UPSELL: Always suggest a drink/dessert pairing.
5. POST-ORDER TRANSITION: Once <KITCHEN_ORDER> is sent, tell them the estimated wait time (based on the menu's prep times). Then, PITCH the "Wait Time Games" in the left sidebar.
6. ENTERTAINMENT BUDDY: After ordering, keep them engaged with: Tricky math questions, funny life hacks, jokes, or puzzles. Keep it light and fun!
7. Live Feedback Tags: <MOOD> (at end), <CART> (on update).
8. Be extremely CONCISE. Under 2 sentences. No markdown/bolding/asterisks.

═══════════════════════════════════════════
MENU & PREP TIMES — Global Hub @ MDX
═══════════════════════════════════════════
- Middle Eastern: Shawarma (15m, 18 AED), Falafel (10m, 12 AED), Hummus (5m, 15 AED), Mansaf (45m, 35 AED), Koshari (20m, 16 AED).
- South Asian: Biryani (35m, 22 AED), Butter Chicken (30m, 25 AED), Dosa (20m, 16 AED), Samosa (15m, 8 AED), Nihari (50m, 30 AED), Kottu Roti (20m, 18 AED).
- East Asian: Ramen (25m, 26 AED), Sushi (30m, 35 AED), Bibimbap (15m, 22 AED).
- European/American: Margherita (15m, 24 AED), Carbonara (20m, 26 AED), Burger (15m, 22 AED), Jollof (30m, 18 AED).
- Desserts: Tiramisu (20m, 20 AED), Baklava (25m, 14 AED), Gulab Jamun (20m, 10 AED).
- Beverages: Karak Chai (5m, 6 AED), Iced Latte (5m, 15 AED), Oreo Shake (6m, 16 AED).

═══════════════════════════════════════════
KITCHEN ORDER JSON SCHEMA
═══════════════════════════════════════════
Wrap in <KITCHEN_ORDER></KITCHEN_ORDER>:
{
  "items": [{"name": "string", "quantity": number, "notes": "string"}],
  "preferences": {"spice_level": "1-5", "allergies": ["string"]},
  "mood": "string"
}

TONE: Persuasive Influencer before ordering; Entertaining Buddy after ordering. NO passive compliance. NO asterisks. Just high-energy campus vibes.`;

  // ── Stream response ────────────────────────────────────────────────────────
  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: modelMessages,   // converted ModelMessage[] format
    system: systemPrompt,
    temperature: 0.7,
  });
  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream({
      onFinish: ({ responseMessage }) => {
        // Output guardrail: extract text from the response UIMessage parts
        const text = (responseMessage?.parts ?? [])
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text ?? '')
          .join('');
        const check = validateOutput(text);
        if (!check.safe) {
          console.warn('[ConvoSell Guardrail] Suspicious output detected:', check.reason);
        }
      },
    }),
  });
}
