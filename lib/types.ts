/** The compact knowledge-base shape written by the scraper (brief §2.6). */

export type KbItem = {
  n: string; // Uzbek title
  s: string; // sku / artikul
  c: number; // index into cats
  sp: string[]; // specifications, max 7
  d: string; // first sentence of the description, <= 150 chars
  u: string; // product slug
  i: string; // image path after the storage prefix
};

export type Kb = {
  cats: [string, string][]; // [top, sub]
  items: KbItem[];
};
