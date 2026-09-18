/**
 * /api/chat va /api/chat/stream uchun umumiy qism.
 *
 * Ikkala marshrut ham bir xil miya va bazadan foydalanadi — farqi faqat
 * javobni qanday yetkazishda (to'liq JSON yoki SSE oqimi).
 */
import OpenAI from 'openai';
import { search, recentText, type SearchHit } from './search';
import { systemPrompt, buildUserTurn } from './prompt';
import { imageUrl, productUrl, narxMatn, omborMatn } from './kb';
import { tilniAniqla, type Til } from './normalize';
import type { Card } from './types';

export const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra';
export const MAX_TOKENS = 2000;
const HISTORY_TURNS = 8;

export type Turn = { role: 'user' | 'assistant'; content: string };

export const RESPONSE_SCHEMA = {
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

/** Sahna avval salomlashadi, API esa user navbatidan boshlanishini talab qiladi. */
export function sanitiseHistory(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw.filter(isTurn).filter((t) => t.content.trim().length > 0);
  const recent = turns.slice(-HISTORY_TURNS);
  const firstUser = recent.findIndex((t) => t.role === 'user');
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

export function tilniTanla(soralgan: unknown, message: string): Til {
  return soralgan === 'ru' || soralgan === 'uz' ? soralgan : tilniAniqla(message);
}

export function messagesQur(message: string, history: Turn[], hits: SearchHit[], til: Til) {
  return [
    { role: 'system' as const, content: systemPrompt(til) },
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: buildUserTurn(message, hits, til) },
  ];
}

export function kontekst(message: string, history: Turn[], til: Til) {
  return search(message, recentText(history), til);
}

/** Faqat kontekstda bo'lgan artikullar kartochkaga aylanadi. */
export function toCards(artikullar: string[], hits: SearchHit[], til: Til): Card[] {
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

export function parseReply(text: string): { javob: string; artikullar: string[] } {
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
      // keyingi nomzod
    }
  }
  return { javob: cleaned, artikullar: [] };
}

/**
 * Oqim paytida yarim JSON keladi: {"javob":"Beton dev
 * Shundan "javob" maydonining hozirgacha kelgan qismini ajratib olamiz, shunda
 * mijoz model yozayotgan paytda o'qiy boshlaydi. Strict schema saqlanadi —
 * oqimni matnga almashtirib, kafolatni yo'qotish shart emas.
 */
export function qismanJavob(xom: string): string {
  const m = xom.match(/"javob"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return '';
  try {
    // Yopilmagan qatorni yopib, JSON qoidalari bo'yicha ochamiz
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
}

export const openai = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
