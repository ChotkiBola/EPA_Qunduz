import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { search, recentText, type SearchHit } from '@/lib/search';
import { systemPrompt, buildUserTurn } from '@/lib/prompt';
import { imageUrl, productUrl, narxMatn, omborMatn, malumotYoshi, narxEskirganmi } from '@/lib/kb';
import { tilniAniqla, type Til } from '@/lib/normalize';
import type { Card } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
const MAX_TOKENS = 2000;
const HISTORY_TURNS = 8;

type Turn = { role: 'user' | 'assistant'; content: string };

type ChatRequest = {
  message?: unknown;
  history?: unknown;
  til?: unknown;
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    javob: { type: 'string' },
    artikullar: { type: 'array', items: { type: 'string' } },
  },
  required: ['javob', 'artikullar'],
  additionalProperties: false,
} as const;

const isTurn = (v: unknown): v is Turn =>
  !!v &&
  typeof v === 'object' &&
  ((v as Turn).role === 'user' || (v as Turn).role === 'assistant') &&
  typeof (v as Turn).content === 'string';

/** The stage greets first, and the API must start on a user turn. */
function sanitiseHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw.filter(isTurn).filter((t) => t.content.trim().length > 0);
  const recent = turns.slice(-HISTORY_TURNS);
  const firstUser = recent.findIndex((t) => t.role === 'user');
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

/** Strict json_schema should make this a plain parse; the fallback stays. */
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
      const parsed = JSON.parse(candidate) as { javob?: unknown; artikullar?: unknown };
      if (typeof parsed.javob === 'string' && parsed.javob.trim()) {
        return {
          javob: parsed.javob.trim(),
          artikullar: Array.isArray(parsed.artikullar)
            ? parsed.artikullar.filter((a): a is string => typeof a === 'string')
            : [],
        };
      }
    } catch {
      // keyingi nomzodga o'tamiz
    }
  }
  return { javob: cleaned, artikullar: [] };
}

/** Faqat kontekstda bo'lgan artikullar kartochkaga aylanadi. */
function toCards(artikullar: string[], hits: SearchHit[], til: Til): Card[] {
  const byS = new Map(hits.map((h) => [h.item.s.toLowerCase(), h.item]));
  const cards: Card[] = [];
  const seen = new Set<string>();

  for (const artikul of artikullar) {
    const item = byS.get(artikul.trim().toLowerCase());
    if (!item || seen.has(item.s)) continue;
    seen.add(item.s);
    cards.push({
      s: item.s,
      n: item.n[til] || item.n.ru,
      url: productUrl(item, til),
      img: item.i ? imageUrl(item.i) : null,
      narx: narxMatn(item.price, til),
      omborda: item.stock > 0,
      ombor: omborMatn(item.stock, til),
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

  if (!process.env.OPENAI_API_KEY) {
    return fail('OPENAI_API_KEY sozlanmagan. .env.local fayliga kalitni qo‘shing.', 500);
  }

  /* Til: foydalanuvchi tanlovi ustun, aks holda savol yozuvidan (brief §2.2). */
  const tanlangan = body.til === 'ru' || body.til === 'uz' ? (body.til as Til) : null;
  const til: Til = tanlangan ?? tilniAniqla(message);

  const history = sanitiseHistory(body.history);
  const hits = search(message, recentText(history), til);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt(til) },
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user', content: buildUserTurn(message, hits, til) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'qunduz_javob', strict: true, schema: RESPONSE_SCHEMA },
      },
    });

    const choice = completion.choices[0];

    if (choice?.message.refusal) {
      return fail(`Model javob berishdan bosh tortdi: ${choice.message.refusal}`, 422);
    }

    const text = choice?.message.content?.trim() ?? '';
    if (!text) {
      return fail(
        choice?.finish_reason === 'length'
          ? 'Javob uzilib qoldi (max_completion_tokens). Qayta urinib ko‘ring.'
          : 'Modeldan bo‘sh javob keldi.',
        502,
      );
    }

    const { javob, artikullar } = parseReply(text);

    return NextResponse.json({
      javob,
      artikullar,
      mahsulotlar: toCards(artikullar, hits, til),
      til,
      // Mijoz interfeysi kerak bo'lsa eskirish haqida ogohlantira olsin
      malumot: {
        yoshi_kun: Math.round(malumotYoshi() * 10) / 10,
        eskirgan: narxEskirganmi(),
      },
    });
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      return fail(`OpenAI API: ${err.message}`, err.status ?? 502);
    }
    return fail(err instanceof Error ? err.message : String(err), 502);
  }
}
