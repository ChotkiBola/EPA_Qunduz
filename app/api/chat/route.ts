import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { search, recentText, type SearchHit } from '@/lib/search';
import { SYSTEM, buildUserTurn } from '@/lib/prompt';
import { imageUrl, productUrl } from '@/lib/kb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-opus-5';
/* The brief's 1000 was measured on a model that did not think. Opus 5 thinks
   by default and max_tokens caps thinking + answer together, so a 1000 cap
   truncates mid-sentence. Low effort keeps the latency budget for the voice. */
const MAX_TOKENS = 2000;
const EFFORT = 'low' as const;
const HISTORY_TURNS = 8;

type Turn = { role: 'user' | 'assistant'; content: string };

type ChatRequest = {
  message?: unknown;
  history?: unknown;
};

/** Card payload for the stage — resolved server-side so the browser never
    has to download the whole knowledge base. */
type Card = {
  s: string; // artikul
  n: string; // Uzbek title
  url: string;
  img: string | null;
};

const isTurn = (v: unknown): v is Turn =>
  !!v &&
  typeof v === 'object' &&
  ((v as Turn).role === 'user' || (v as Turn).role === 'assistant') &&
  typeof (v as Turn).content === 'string';

/**
 * The Messages API requires the conversation to start on a user turn, and the
 * stage opens with Qunduz greeting first — so drop any leading assistant turns
 * after slicing.
 */
function sanitiseHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw.filter(isTurn).filter((t) => t.content.trim().length > 0);
  const recent = turns.slice(-HISTORY_TURNS);
  const firstUser = recent.findIndex((t) => t.role === 'user');
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

/** The model is told to answer with bare JSON, but be forgiving anyway. */
function parseReply(text: string): { javob: string; artikullar: string[] } {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const candidates = [cleaned];
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(cleaned.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        javob?: unknown;
        artikullar?: unknown;
      };
      if (typeof parsed.javob === 'string' && parsed.javob.trim()) {
        return {
          javob: parsed.javob.trim(),
          artikullar: Array.isArray(parsed.artikullar)
            ? parsed.artikullar.filter((a): a is string => typeof a === 'string')
            : [],
        };
      }
    } catch {
      // fall through to the next candidate
    }
  }

  // A silent empty answer was a real bug in the prototype — show the raw text.
  return { javob: cleaned, artikullar: [] };
}

/** Only ever return artikuls that were actually in the context. */
function toCards(artikullar: string[], hits: SearchHit[]): Card[] {
  const byS = new Map(hits.map((h) => [h.item.s.toLowerCase(), h.item]));
  const cards: Card[] = [];
  const seen = new Set<string>();

  for (const artikul of artikullar) {
    const item = byS.get(artikul.trim().toLowerCase());
    if (!item || seen.has(item.s)) continue;
    seen.add(item.s);
    cards.push({
      s: item.s,
      n: item.n,
      url: productUrl(item.u),
      img: item.i ? imageUrl(item.i) : null,
    });
    if (cards.length === 3) break;
  }
  return cards;
}

const fail = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return fail('So‘rov formati noto‘g‘ri (JSON kutilgan).', 400);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return fail('Savol bo‘sh.', 400);

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail(
      'ANTHROPIC_API_KEY sozlanmagan. .env.local fayliga kalitni qo‘shing.',
      500,
    );
  }

  const history = sanitiseHistory(body.history);
  const hits = search(message, recentText(history));

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      output_config: { effort: EFFORT },
      messages: [
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: buildUserTurn(message, hits) },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return fail('Model bu savolga javob berishdan bosh tortdi.', 422);
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!text) {
      return fail(
        response.stop_reason === 'max_tokens'
          ? 'Javob uzilib qoldi (max_tokens). Qayta urinib ko‘ring.'
          : 'Modeldan bo‘sh javob keldi.',
        502,
      );
    }

    const { javob, artikullar } = parseReply(text);

    return NextResponse.json({
      javob,
      artikullar,
      mahsulotlar: toCards(artikullar, hits),
    });
  } catch (err) {
    // Never swallow an upstream error — the UI shows it verbatim.
    if (err instanceof Anthropic.APIError) {
      return fail(`Anthropic API: ${err.message}`, err.status ?? 502);
    }
    return fail(err instanceof Error ? err.message : String(err), 502);
  }
}
