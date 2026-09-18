/**
 * Katalog bo'yicha qidiruv.
 *
 * Algoritm v1 briefdan o'zgarmagan (tekshirilgan): STOP ro'yxati, normalizator,
 * tokenizator va +12 / +3 / +2 / +1 ballari. O'zgargani — indeks endi ikki
 * tilda quriladi, chunki katalog o'zbekcha va ruscha nomlarni saqlaydi.
 */
import { kb } from './kb';
import type { Mahsulot } from './scrape-epamarket';
import type { Til } from './normalize';

const STOP = new Set([
  // o'zbekcha
  'va', 'uchun', 'bilan', 'qanday', 'qaysi', 'nima', 'menga', 'kerak', 'bor',
  'iltimos', 'eng', 'yaxshi', 'ayting', 'bering', 'tavsiya', 'qiling', 'men',
  'siz', 'shu', 'bu',
  // ruscha — endi ruscha savollar ham keladi
  'для', 'что', 'как', 'какой', 'какая', 'нужен', 'нужна', 'нужно', 'есть',
  'мне', 'пожалуйста', 'самый', 'лучший', 'посоветуйте', 'скажите', 'это',
  // inglizcha
  'the', 'and', 'for', 'with', 'what', 'which', 'how',
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
  item: Mahsulot;
  sku: string;
  blob: string;
};

/* Indeks ikki tilni ham o'z ichiga oladi: mijoz ruscha nom bilan izlab,
   o'zbekcha javob olishi mumkin va aksincha. */
const index: Indexed[] = kb.items.map((item) => {
  const kat = kb.cats[item.c] ?? { uz: '', ru: '' };
  return {
    item,
    sku: norm(item.s),
    blob: norm(
      [
        item.n.uz, item.n.ru,
        item.s,
        kat.uz, kat.ru,
        item.sp.uz.join(' '), item.sp.ru.join(' '),
        item.d.uz, item.d.ru,
      ].join(' '),
    ),
  };
});

export const categoryList = (til: Til) =>
  kb.cats.map((c) => c[til] || c.ru).join('; ');

export type SearchHit = {
  item: Mahsulot;
  kat: string;
  score: number;
};

export function search(
  query: string,
  recent = '',
  til: Til = 'uz',
  limit = 7,
): SearchHit[] {
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
    if (score > 0) {
      const kat = kb.cats[entry.item.c] ?? { uz: '', ru: '' };
      hits.push({ item: entry.item, kat: kat[til] || kat.ru, score });
    }
  }

  /* Teng ballda omborda bori oldinga chiqadi — mijozga bugun sotib
     olinadigan mahsulotni ko'rsatish foydaliroq. */
  hits.sort((a, b) => b.score - a.score || Number(b.item.stock > 0) - Number(a.item.stock > 0));
  return hits.slice(0, limit);
}

export const recentText = (
  history: { role: string; content: string }[],
  count = 4,
) =>
  history
    .slice(-count)
    .map((m) => m.content)
    .join(' ');
