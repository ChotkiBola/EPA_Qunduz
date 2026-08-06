import kbJson from '@/data/kb.json';

/** One catalogue entry, in the compact shape the scraper writes (brief §2.6). */
export type KbItem = {
  n: string; // Uzbek title
  s: string; // sku / artikul
  c: number; // index into cats
  sp: string[]; // specifications, max 7
  d: string; // first sentence of the description
  u: string; // product slug
  i: string; // image path after the storage prefix
};

export type Kb = {
  cats: [string, string][]; // [top, sub]
  items: KbItem[];
};

export const kb = kbJson as Kb;

export const IMAGE_BASE = 'https://images.epa.uz/storage/images/';

export const productUrl = (slug: string) => `https://epa.uz/uz/product/${slug}`;

export const imageUrl = (path: string) => `${IMAGE_BASE}${path}`;
