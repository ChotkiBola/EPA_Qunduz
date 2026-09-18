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

/** Success shape of POST /api/chat. Errors come back as { error }. */
export type ChatResponse = {
  javob: string;
  artikullar: string[];
  mahsulotlar: Card[];
};

/** Avatar holat mashinasi (brief v3 §2): idle → listening → thinking → speaking */
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** Kartochka — /api/chat serverda tayyorlab beradi (brief v4 §4). */
export type Card = {
  s: string;            // artikul
  n: string;            // nom (so'ralgan tilda)
  url: string;
  img: string | null;
  narx: string | null;  // ekran uchun aniq narx, masalan "1 409 100 soʻm"
  omborda: boolean;
  ombor: string;        // "omborda bor" / "hozir yo‘q, oldindan buyurtma"
};
