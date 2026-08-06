/**
 * Retrieval over the EPA catalogue — LOCKED algorithm (brief §3).
 *
 * Plain keyword scoring, no embeddings. Ported verbatim from the tested
 * prototype: the STOP list, the normaliser, the tokeniser and the three
 * scoring rules below are not to be redesigned.
 */
import { kb } from './kb';
import type { KbItem } from './types';

const STOP = new Set([
  'va',
  'uchun',
  'bilan',
  'qanday',
  'qaysi',
  'nima',
  'menga',
  'kerak',
  'bor',
  'iltimos',
  'eng',
  'yaxshi',
  'ayting',
  'bering',
  'tavsiya',
  'qiling',
  'men',
  'siz',
  'shu',
  'bu',
  'the',
  'and',
  'for',
  'with',
  'what',
  'which',
  'how',
]);

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’ʻʼ`]/g, "'")
    .replace(/[^a-z0-9а-яё'\s\-]/gi, ' ');

export const toks = (s: string) =>
  norm(s)
    .split(/[\s\-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

type Indexed = {
  item: KbItem;
  top: string;
  sub: string;
  sku: string;
  blob: string;
};

/** Built once per server process — 940 products, cheap enough. */
const index: Indexed[] = kb.items.map((item) => {
  const [top, sub] = kb.cats[item.c] ?? ['', ''];
  return {
    item,
    top,
    sub,
    sku: norm(item.s),
    blob: norm([item.n, item.s, sub, top, item.sp.join(' '), item.d].join(' ')),
  };
});

/** All 95 "top / sub" pairs, for the KATALOG KATEGORIYALARI line. */
export const categoryList = kb.cats.map(([t, s]) => `${t} / ${s}`).join('; ');

export type SearchHit = {
  item: KbItem;
  top: string;
  sub: string;
  score: number;
};

/**
 * @param query  the customer's message
 * @param recent text of the last ~4 conversation messages, so follow-ups
 *               ("va undan kuchliroq bormi?") still retrieve
 */
export function search(query: string, recent = '', limit = 7): SearchHit[] {
  const tokens = Array.from(new Set(toks(`${query} ${recent}`)));
  if (tokens.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const entry of index) {
    let score = 0;
    for (const t of tokens) {
      if (entry.sku.includes(t)) score += 12;
      if (entry.blob.includes(` ${t}`)) score += t.length > 4 ? 3 : 2;
      else if (entry.blob.includes(t)) score += 1;
    }
    // A zero score is a non-match; padding the context with random products
    // would only invite the model to recommend something irrelevant.
    if (score > 0) {
      hits.push({ item: entry.item, top: entry.top, sub: entry.sub, score });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Last ~4 messages of conversation text, folded into the query. */
export const recentText = (
  history: { role: string; content: string }[],
  count = 4,
) =>
  history
    .slice(-count)
    .map((m) => m.content)
    .join(' ');
