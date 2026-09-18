/**
 * npm run scrape — epamarket katalogini data/kb.json ga yozadi.
 *
 * Brief v4 §5: mahsulot soni oldingisidan 20% dan ko'p kamaygan bo'lsa
 * yozilmaydi, va oldingi nusxa bitta versiya orqaga qaytish uchun saqlanadi.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { scrapeEpamarket, type Kb2 } from '../lib/scrape-epamarket';

const OUT = path.join(process.cwd(), 'data', 'kb.json');
const OLD = path.join(process.cwd(), 'data', 'kb.oldingi.json');

/* To'liq katalog ~30 daqiqa oladi (924 mahsulot, har biri alohida so'rov).
   Bu prebuild da ishlaydi, ya'ni har bir deploy shuncha turardi — Vercel
   build limitiga yaqin va kod tuzatish uchun qabul qilib bo'lmaydigan.
   Shuning uchun: ma'lumot shu yoshdan yosh bo'lsa, scrape o'tkazib
   yuboriladi. Kunlik cron 24 soatda bir marta keladi, demak u baribir
   har safar yangilaydi; oradagi oddiy deploylar tayyor faylni oladi. */
const MAX_SOAT = Number(process.env.SCRAPE_MAX_AGE_HOURS ?? 12);
const MAJBURIY = process.argv.includes('--force') || process.env.SCRAPE_FORCE === '1';

async function oldingi(): Promise<Kb2 | null> {
  try {
    return JSON.parse(await readFile(OUT, 'utf8')) as Kb2;
  } catch {
    return null;
  }
}

/** Mavjud fayl yetarlicha yangi bo'lsa — necha soatligini qaytaradi. */
function yetarlichaYangi(eski: Kb2 | null): number | null {
  if (MAJBURIY || !Number.isFinite(MAX_SOAT) || MAX_SOAT <= 0) return null;
  if (eski?.version !== 2 || !eski.items?.length) return null;

  const t = Date.parse(eski.updated_at ?? '');
  if (!Number.isFinite(t)) return null;

  const soat = (Date.now() - t) / 3_600_000;
  return soat >= 0 && soat < MAX_SOAT ? soat : null;
}

async function main() {
  const eski = await oldingi();

  const soat = yetarlichaYangi(eski);
  if (soat !== null) {
    console.log(
      `data/kb.json ${soat.toFixed(1)} soatlik (chegara ${MAX_SOAT}h) — ` +
        `scrape o'tkazib yuborildi. Majburlash: npm run scrape -- --force`,
    );
    return;
  }

  const kb = await scrapeEpamarket((m) => console.log(m));

  if (eski?.items?.length) {
    const nisbat = kb.items.length / eski.items.length;
    console.log(
      `mahsulot: ${eski.items.length} → ${kb.items.length} (${(nisbat * 100 - 100).toFixed(1)}%)`,
    );
    if (nisbat < 0.8) {
      throw new Error(
        `katalog 20% dan ko'p qisqardi (${eski.items.length} → ${kb.items.length}). ` +
          `Yozilmadi — buzuq javob bazani vayron qilmasin.`,
      );
    }
    // Bitta versiya orqaga qaytish imkoni
    await copyFile(OUT, OLD).catch(() => {});
  }

  const json = JSON.stringify(kb);
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, json, 'utf8');
  console.log(`yozildi data/kb.json — ${(json.length / 1024).toFixed(0)} KB, updated_at ${kb.updated_at}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
