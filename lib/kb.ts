import kbJson from '@/data/kb.json';
import type { Kb2, Mahsulot } from './scrape-epamarket';
import type { Til } from './normalize';

export type { Kb2, Mahsulot, Ikkitil } from './scrape-epamarket';

export const kb = kbJson as unknown as Kb2;

/* Shakl tekshiruvi. Busiz eski (v1) fayl bilan ilova qidiruv indeksini
   qurayotganda "Cannot read properties of undefined" bilan yiqiladi —
   sababi ko'rinmaydi va har bir marshrut o'ladi. `npm run scrape` yechim. */
if (!kb || kb.version !== 2 || !Array.isArray(kb.items)) {
  throw new Error(
    `data/kb.json noto‘g‘ri shaklda (version=${(kb as { version?: unknown })?.version}). ` +
      'epamarket katalogi kutilyapti — `npm run scrape` bilan qayta yarating.',
  );
}

export const IMAGE_BASE = 'https://images.epa.uz/storage/images/';

export const imageUrl = (path: string) => `${IMAGE_BASE}${path}`;

/** epamarket mahsulot sahifasi — til bo'yicha alohida slug. */
export const productUrl = (m: Mahsulot, til: Til) =>
  `https://epamarket.uz/${til}/product/${m.u[til] || m.u.ru}`;

/* ──────────────────────────────────────────────────────── narx ── */

/**
 * Ekran uchun aniq narx: "1 409 100 so'm".
 *
 * Ovoz uchun bu ishlatilmaydi — u yerda narxOvozUchun() yumaloqlaydi
 * (brief v4 §3.4). Ekranda aniq, quloqda tushunarli.
 */
export function narxMatn(price: number | null, til: Til): string | null {
  if (price === null) return null;
  const raqam = price.toLocaleString('ru-RU').replace(/ /g, ' ');
  return til === 'ru' ? `${raqam} сум` : `${raqam} soʻm`;
}

export const omborMatn = (stock: number, til: Til) =>
  stock > 0
    ? til === 'ru'
      ? 'в наличии'
      : 'omborda bor'
    : til === 'ru'
      ? 'нет в наличии, под заказ'
      : 'hozir yo‘q, oldindan buyurtma';

/* ─────────────────────────────────────────────── ma'lumot yoshi ── */

const KUN = 24 * 60 * 60 * 1000;
export const ESKIRISH_KUNI = 7;

/** Ma'lumot necha kunlik. Sana yo'q yoki buzuq bo'lsa — cheksiz eski. */
export function malumotYoshi(kbData: Kb2 = kb): number {
  const t = Date.parse(kbData.updated_at ?? '');
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / KUN;
}

/**
 * Narx 7 kundan eski bo'lsa, javobga qisqa eslatma qo'shiladi (brief v4 §1.5).
 * Eskirgan narxni ishonch bilan aytish eng yomon variant — mijoz do'konga
 * borib boshqa raqamni ko'radi.
 */
export const narxEskirganmi = (kbData: Kb2 = kb) =>
  malumotYoshi(kbData) > ESKIRISH_KUNI;
