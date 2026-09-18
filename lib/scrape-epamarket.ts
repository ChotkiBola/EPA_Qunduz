/**
 * epamarket.uz katalogini olish (brief v4 §1).
 *
 * epa.uz dan farqi — bu yerda narx va ombor holati bor, demak Qunduz har
 * savolda savdo bo'limiga yo'naltirishga majbur emas.
 *
 * Manba qirib olinmaydi: api2.epamarket.uz ochiq REST API beradi.
 *   GET /api/v1/products?page=N      → ro'yxat (narxsiz), Accept-Language ni qo'llaydi
 *   GET /api/v1/products/{slug}      → batafsil: epamarket_price, epamarket_stock,
 *                                      specifications, barcha tillardagi slug
 *   GET /api/v1/categories           → kategoriyalar
 *
 * Ro'yxatda narx yo'q, batafsilda bor — shuning uchun har mahsulot uchun
 * alohida so'rov shart. Ikki tilda nom va spetsifikatsiya kerak bo'lgani
 * uchun ikki marta.
 */
import { firstSentence } from './scrape';
import type { Til } from './normalize';

const API = 'https://api2.epamarket.uz/api/v1';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
/* 16 parallel so'rovda API 429 qaytardi va katalogning 93% i olinmadi.
   Chegara o'lchandi: 3 parallel ~7.8 so'rov/sek beradi va 429 chiqmaydi.
   4 — o'lchab topilgan, xizmatni bezovta qilmaydigan daraja. */
const CONCURRENCY = 3;
const MAX_SPECS = 7;

export type Ikkitil = { uz: string; ru: string };

export type Mahsulot = {
  id: string;
  s: string; // sku / model kodi
  c: number; // kategoriya indeksi
  n: Ikkitil; // nom
  d: Ikkitil; // tavsifning birinchi gapi
  sp: { uz: string[]; ru: string[] }; // spetsifikatsiyalar
  u: Ikkitil; // slug
  i: string; // rasm yo'li
  price: number | null;
  stock: number;
};

export type Kb2 = {
  version: 2;
  source: 'epamarket';
  updated_at: string;
  cats: Ikkitil[];
  items: Mahsulot[];
};

type RawSpec = {
  name?: string;
  unit?: string | null;
  options?: { name?: string | null }[] | null;
};

type RawDetail = {
  id?: string;
  sku?: string;
  title?: string;
  slug?: Record<string, string> | string;
  description?: string;
  specifications?: RawSpec[] | null;
  images?: { sizes?: { small?: string | null } | null }[] | null;
  category?: { id?: string; name?: string } | null;
  epamarket_price?: number | null;
  epamarket_stock?: number | null;
};

const IMAGE_PREFIX = 'https://images.epa.uz/storage/images/';

const headers = (til: Til) => ({
  'User-Agent': UA,
  Accept: 'application/json',
  ...(til === 'uz' ? { 'Accept-Language': 'uz' } : {}),
});

async function getJson<T>(path: string, til: Til, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${API}${path}`, { headers: headers(til) });

      /* 429 ni oddiy xato kabi qayta urinish foydasiz — u tezlikdan
         shikoyat qilyapti, shuning uchun kutish uzunroq va Retry-After
         sarlavhasi bo'lsa o'sha hurmat qilinadi. */
      if (res.status === 429) {
        const kut = Number(res.headers.get('retry-after')) * 1000 || 1500 * 2 ** i;
        await new Promise((r) => setTimeout(r, kut));
        last = new Error(`429 Too Many Requests — ${path}`);
        continue;
      }

      if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
      return (await res.json()) as T;
    } catch (err) {
      last = err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : new Error(`so‘rov muvaffaqiyatsiz: ${path}`);
}

async function pool<T>(items: T[], limit: number, work: (t: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}

/** `{ name: 'Quvvat', unit: 'Vt', options: [{name:'750'}] }` → `Quvvat: 750 Vt` */
function specLine(spec: RawSpec): string | null {
  const name = spec.name?.trim();
  const values = (spec.options ?? [])
    .map((o) => o?.name?.trim())
    .filter((v): v is string => !!v)
    .join(', ');
  if (!name || !values) return null;
  const unit = spec.unit?.trim();
  return unit ? `${name}: ${values} ${unit}` : `${name}: ${values}`;
}

const specLines = (d: RawDetail) =>
  (d.specifications ?? [])
    .map(specLine)
    .filter((l): l is string => !!l)
    .slice(0, MAX_SPECS);

const imagePath = (d: RawDetail) => {
  const url = d.images?.[0]?.sizes?.small ?? '';
  return url.startsWith(IMAGE_PREFIX) ? url.slice(IMAGE_PREFIX.length) : url;
};

export type ScrapeLog = (m: string) => void;

export async function scrapeEpamarket(log: ScrapeLog = () => {}): Promise<Kb2> {
  const started = Date.now();

  // 1. Ro'yxatni varaqlab, ruscha sluglarni yig'amiz (batafsil so'rov kaliti).
  type List = {
    data: { id: string; slug: string }[];
    meta?: { last_page?: number };
  };
  const first = await getJson<List>('/products?page=1', 'ru');
  const lastPage = first.meta?.last_page ?? 1;
  const slugs = new Map<string, string>(); // id -> ru slug
  for (const p of first.data) slugs.set(p.id, p.slug);

  const pages = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
  await pool(pages, CONCURRENCY, async (page) => {
    const j = await getJson<List>(`/products?page=${page}`, 'ru');
    for (const p of j.data) slugs.set(p.id, p.slug);
  });
  log(`${slugs.size} mahsulot, ${lastPage} sahifa`);

  // 2. Har mahsulot uchun ikki tilda batafsil. Narx va ombor faqat shu yerda.
  const catIndex = new Map<string, number>();
  const cats: Ikkitil[] = [];
  const items: Mahsulot[] = [];
  const failures: string[] = [];

  /* Uzoq davom etadigan bosqich — jim turgan jarayon osilganga o'xshaydi,
     shuning uchun har 100 tada hisob chiqadi. */
  let bajarildi = 0;
  await pool([...slugs.entries()], CONCURRENCY, async ([id, ruSlug]) => {
    if (++bajarildi % 100 === 0) log(`  ${bajarildi}/${slugs.size}`);
    try {
      const ru = (await getJson<{ data: RawDetail }>(`/products/${encodeURIComponent(ruSlug)}`, 'ru')).data;

      const slugObj = typeof ru.slug === 'object' && ru.slug ? ru.slug : {};
      const uzSlug = slugObj.uz || ruSlug;
      const uz = (await getJson<{ data: RawDetail }>(`/products/${encodeURIComponent(uzSlug)}`, 'uz')).data;

      const katRu = ru.category?.name?.trim() || '';
      const katUz = uz.category?.name?.trim() || katRu;
      const katKey = ru.category?.id || katRu;
      let c = catIndex.get(katKey);
      if (c === undefined) {
        c = cats.push({ uz: katUz, ru: katRu }) - 1;
        catIndex.set(katKey, c);
      }

      const price = typeof ru.epamarket_price === 'number' ? ru.epamarket_price : null;

      items.push({
        id,
        s: (ru.sku ?? '').trim(),
        c,
        n: { uz: (uz.title ?? ru.title ?? '').trim(), ru: (ru.title ?? '').trim() },
        d: { uz: firstSentence(uz.description), ru: firstSentence(ru.description) },
        sp: { uz: specLines(uz), ru: specLines(ru) },
        u: { uz: uzSlug, ru: ruSlug },
        i: imagePath(ru),
        price,
        stock: typeof ru.epamarket_stock === 'number' ? ru.epamarket_stock : 0,
      });
    } catch (err) {
      failures.push(`${ruSlug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  if (failures.length) {
    log(`${failures.length} mahsulot olinmadi`);
    // Yarim katalog eskisidan yomonroq — yozishdan ko'ra to'xtagan ma'qul.
    if (failures.length > slugs.size / 10) {
      throw new Error(
        `juda ko'p mahsulot olinmadi (${failures.length}/${slugs.size}):\n${failures.slice(0, 5).join('\n')}`,
      );
    }
  }
  if (items.length === 0) throw new Error('hech qanday mahsulot olinmadi');

  const narxli = items.filter((i) => i.price !== null).length;
  const omborda = items.filter((i) => i.stock > 0).length;
  log(
    `${items.length} mahsulot, ${cats.length} kategoriya, ${narxli} tasida narx, ${omborda} tasi omborda, ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  return {
    version: 2,
    source: 'epamarket',
    updated_at: new Date().toISOString(),
    cats,
    items,
  };
}
