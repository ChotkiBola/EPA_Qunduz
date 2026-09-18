/**
 * Matnni ovozga tayyorlash (brief v4 §3).
 *
 * Hammasi FAQAT ovozga ketadigan nusxada bajariladi — ekranda mahsulot nomi,
 * narxi va model kodi o'zgarmasdan qoladi.
 *
 * Bosqichlar tartibi muhim va u shunchaki did emas:
 *   1. Model kodlari — ichida ham harf, ham son bor. Sonlar bosqichi ularni
 *      "EEP-yigirma sakkiz-uch" qilib buzishidan oldin ajratib olinadi.
 *   2. Narxlar — "so'm" bilan kelgan uzun son alohida qoida bo'yicha
 *      yumaloqlanadi, umumiy sonlar qoidasi uni to'liq o'qib yuborardi.
 *   3. Qisqartmalar — sonlar hali raqam holida turishi kerak, chunki
 *      "750 Вт" dagi "Вт" ni topish uchun oldidagi raqam kerak.
 *   4. Sonlar → so'z.
 *   5. Apostrof — eng oxirida, chunki yuqoridagi bosqichlar oʻzi U+02BB
 *      qo'shadi va ularni qayta ishlash shart emas.
 */

export type Til = 'uz' | 'ru';

/* ─────────────────────────────────────────────────── §3.1 apostrof ── */

const OG_APOSTROF = /([oOgG])['‘’ʼ`´]/g;

export const apostrof = (s: string) => s.replace(OG_APOSTROF, '$1ʻ');

/* ──────────────────────────────────────────────── §3.3 sonlar (uz) ── */

const BIRLIK = [
  '', 'bir', 'ikki', 'uch', 'toʻrt', 'besh',
  'olti', 'yetti', 'sakkiz', 'toʻqqiz',
];
const ONLIK = [
  '', 'oʻn', 'yigirma', 'oʻttiz', 'qirq', 'ellik',
  'oltmish', 'yetmish', 'sakson', 'toʻqson',
];

function uchXona(n: number): string {
  const yuz = Math.floor(n / 100);
  const qolgan = n % 100;
  const parts: string[] = [];

  /* Brief ichida ziddiyat bor: §3.3 namunaviy kodi 125 ni "yuz yigirma besh"
     qiladi, §3.6 sinov jadvali esa "bir yuz yigirma besh" ni kutadi. §7
     qabul mezoni "3.6 dagi barcha testlar o'tadi" deydi, shuning uchun
     jadval ustun — va u rasmiy o'qilish shakli hamdir. */
  if (yuz >= 1) parts.push(BIRLIK[yuz], 'yuz');

  if (qolgan >= 10) parts.push(ONLIK[Math.floor(qolgan / 10)]);
  if (qolgan % 10) parts.push(BIRLIK[qolgan % 10]);

  return parts.filter(Boolean).join(' ');
}

export function sonUz(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return 'minus ' + sonUz(-n);
  if (n === 0) return 'nol';

  const DARAJA: [number, string][] = [
    [1e9, 'milliard'],
    [1e6, 'million'],
    [1e3, 'ming'],
  ];
  const parts: string[] = [];
  let qoldiq = Math.floor(n);

  for (const [qiymat, nom] of DARAJA) {
    const son = Math.floor(qoldiq / qiymat);
    if (son) {
      // Yuqoridagi sabab bilan bu yerda ham "bir ming" (§3.6: 1200 →
      // "bir ming ikki yuz"), namunaviy koddagi yalang'och "ming" emas.
      parts.push(uchXona(son), nom);
      qoldiq %= qiymat;
    }
  }

  if (qoldiq) parts.push(uchXona(qoldiq));
  return parts.filter(Boolean).join(' ');
}

/* Rus tilida jins, kelishik va son shakllari bor — qo'lda yozish xato
   keltiradi, shuning uchun paket. Paket oxiriga "целых" qo'shadi (u kasr
   qism uchun), uni kesamiz. */
export function sonRu(n: number): string {
  if (!Number.isFinite(n)) return '';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { convert } = require('number-to-words-ru') as {
    convert: (n: number, o?: Record<string, unknown>) => string;
  };
  const raw = convert(Math.floor(n), {
    currency: 'number',
    showNumberParts: { integer: true, fractional: false },
  });
  const tozalangan = raw.replace(/\s*целых\s*$/i, '').trim();
  return tozalangan.charAt(0).toLowerCase() + tozalangan.slice(1);
}

export const son = (n: number, til: Til) => (til === 'ru' ? sonRu(n) : sonUz(n));

/* ────────────────────────────────────────────── §3.4 narxni yumshatish ── */

/**
 * Ekranda aniq narx, ovozda yumaloqlangan.
 *
 * "bir million toʻrt yuz toʻqqiz ming yuz soʻm" quloqda yo'qoladi. "Taxminan"
 * so'zi ayni paytda ehtiyot chorasi ham: narx o'zgargan bo'lsa, Qunduz aniq
 * raqam aytib yolg'onchi bo'lib qolmaydi.
 */
export function narxOvozUchun(narx: number, til: Til): string {
  const yumaloq =
    narx >= 1e6
      ? Math.round(narx / 1e5) * 1e5
      : Math.round(narx / 1e4) * 1e4;

  return til === 'uz'
    ? `taxminan ${sonUz(yumaloq)} soʻm`
    : `примерно ${sonRu(yumaloq)} сум`;
}

/* ──────────────────────────────────────────────── §3.2 qisqartmalar ── */

export const QISQARTMALAR: Record<Til, Record<string, string>> = {
  uz: {
    mm: 'millimetr', sm: 'santimetr', m: 'metr', km: 'kilometr',
    ml: 'millilitr', l: 'litr',
    g: 'gramm', kg: 'kilogramm', t: 'tonna',
    V: 'volt', kV: 'kilovolt', W: 'vatt', kW: 'kilovatt',
    // Bazadagi ma'lumot aralash yozilgan: ruscha birliklar o'zbekcha
    // tavsiflarda ham uchraydi, shuning uchun ular ham shu ro'yxatda.
    'Вт': 'vatt', 'кВт': 'kilovatt', 'В': 'volt', 'А': 'amper',
    A: 'amper', Ah: 'amper-soat', Hz: 'gerts',
    bar: 'bar', atm: 'atmosfera',
    'l/min': 'litr daqiqada', 'm3/h': 'kub metr soatda',
    rpm: 'daqiqada aylanish', 'ob/min': 'daqiqada aylanish',
    "so'm": 'soʻm', 'сум': 'soʻm', UZS: 'soʻm',
  },
  ru: {
    mm: 'миллиметр', 'см': 'сантиметр', 'м': 'метр',
    'мл': 'миллилитр', 'л': 'литр',
    'г': 'грамм', 'кг': 'килограмм',
    'Вт': 'ватт', 'кВт': 'киловатт', 'В': 'вольт', 'А': 'ампер',
    'Гц': 'герц', 'бар': 'бар',
    'л/мин': 'литров в минуту', 'м3/ч': 'кубометров в час',
    'об/мин': 'оборотов в минуту',
    'сум': 'сум',
  },
};

const qochir = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * Qisqartma faqat sondan keyin kelganda ochiladi.
 *
 * Busiz "Vaqt" ichidagi "t" tonnaga, "metall" ichidagi "m" metrga aylanardi.
 * Bir harfli birliklar shuning uchun ayniqsa xavfli.
 */
function qisqartmalarniOch(matn: string, til: Til): string {
  const jadval = QISQARTMALAR[til];
  // Uzun kalitlar oldin: "l/min" "l" dan avval topilishi kerak.
  const kalitlar = Object.keys(jadval).sort((a, b) => b.length - a.length);

  let out = matn;
  for (const kalit of kalitlar) {
    // Bir harfli birlik — katta/kichik harf farqi ma'noli (V volt, v emas).
    const bayroq = kalit.length === 1 ? 'g' : 'gi';
    const re = new RegExp(`(\\d)\\s*${qochir(kalit)}(?![\\p{L}\\d])`, bayroq + 'u');
    out = out.replace(re, `$1 ${jadval[kalit]}`);
  }
  return out;
}

/* ───────────────────────────────────────────────── §3.5 model kodlari ── */

/* SH va CH — o'zbek alifbosidagi bitta tovush, ularni ajratib yuborish
   "es ha" bo'lib eshitiladi. Shuning uchun birga qoladi. */
const DIGRAFLAR = ['SH', 'CH', 'NG'];

function harflarniYoy(harflar: string): string {
  const out: string[] = [];
  let i = 0;
  const katta = harflar.toUpperCase();
  while (i < katta.length) {
    const juft = katta.slice(i, i + 2);
    if (DIGRAFLAR.includes(juft)) {
      out.push(juft);
      i += 2;
    } else {
      out.push(katta[i]);
      i += 1;
    }
  }
  return out.join(' ');
}

/**
 * "EEP-28-3" → "E E P, yigirma sakkiz, uch"
 *
 * Harflar alohida, sonlar so'z bilan, ajratgichlar vergul — TTS vergulni
 * qisqa to'xtam deb o'qiydi, bu esa kodni eshitib yozib olishni osonlashtiradi.
 */
const MODEL_KOD = /\b([A-Z]{2,}[A-Z0-9]*(?:[-/][A-Z0-9]+)+)\b/g;

function modelKodlarniOch(matn: string, til: Til): string {
  return matn.replace(MODEL_KOD, (kod) => {
    const bolaklar = kod.split(/[-/]/).filter(Boolean);
    return bolaklar
      .map((b) => {
        if (/^\d+$/.test(b)) return son(Number(b), til);
        if (/^[A-Z]+$/.test(b)) return harflarniYoy(b);
        // Aralash bo'lak, masalan "RO7" — harf qismi va son qismi alohida
        return b
          .split(/(\d+)/)
          .filter(Boolean)
          .map((q) => (/^\d+$/.test(q) ? son(Number(q), til) : harflarniYoy(q)))
          .join(' ');
      })
      .join(', ');
  });
}

/* ─────────────────────────────────────────────────── sonlar → so'z ── */

/* Ming ajratgichi bo'sh joy yoki uzilmas bo'sh joy bo'lishi mumkin:
   "1 409 100". Nuqta va vergul bilan ajratilganini ataylab olmaymiz —
   ular kasr belgisi bo'lishi ham mumkin. */
const SON_NAQSHI = /\d[\d   ]*\d|\d/g;

function sonlarniOch(matn: string, til: Til): string {
  return matn.replace(SON_NAQSHI, (xom) => {
    const raqam = Number(xom.replace(/[\s  ]/g, ''));
    if (!Number.isFinite(raqam)) return xom;
    // Juda uzun raqam ehtimol kod, telefon yoki artikul — tegilmaydi.
    if (xom.replace(/\D/g, '').length > 12) return xom;
    return son(raqam, til);
  });
}

/* ───────────────────────────────────────────────────── narx naqshi ── */

/** "1 409 100 so'm" / "536800 сум" — birligi bilan kelgan narx. */
const NARX_NAQSHI =
  /(\d[\d   ]{2,}\d|\d{4,})\s*(so['’ʻʼ`]m|soʻm|сум|сўм|UZS)/gi;

function narxlarniOch(matn: string, til: Til): string {
  return matn.replace(NARX_NAQSHI, (_, raqam: string) => {
    const n = Number(raqam.replace(/[\s  ]/g, ''));
    return Number.isFinite(n) ? narxOvozUchun(n, til) : _;
  });
}

/* ──────────────────────────────────────────────────── til aniqlash ── */

/**
 * Qaysi yozuv ko'p bo'lsa — o'sha til.
 *
 * §2.2 "kirill ulushi 30% dan ko'p bo'lsa ruscha" deydi, lekin bu §7 dagi
 * "kirill aralashgan savolda ham o'zbekcha javob" mezoniga zid: ruscha
 * mahsulot nomi ishlatilgan o'zbekcha savol ("Шлифовальная mashinasi bormi?")
 * 46% kirill beradi va 30% qoidasi uni ruscha deb belgilaydi. Ko'pchilik
 * yozuv qoidasi ikkala mezonni ham qanoatlantiradi: o'sha savol lotinda
 * qoladi, "Сколько стоит EEP-28-3?" esa 80% kirill bilan ruscha bo'ladi.
 *
 * Faqat harflar hisoblanadi — raqam va tinish belgilari ikkala tilda bir xil.
 */
export function tilniAniqla(matn: string): Til {
  const harflar = matn.match(/\p{L}/gu) ?? [];
  if (harflar.length === 0) return 'uz';
  const kirill = harflar.filter((c) => /[Ѐ-ӿ]/.test(c)).length;
  const lotin = harflar.length - kirill;
  return kirill > lotin ? 'ru' : 'uz';
}

/* ───────────────────────────────────────────────────────── asosiy ── */

/** Ovozga ketadigan matnni to'liq tayyorlaydi. Ekran matni tegilmaydi. */
export function ovozgaTayyorla(matn: string, til: Til = 'uz'): string {
  let out = matn;
  out = modelKodlarniOch(out, til);
  out = narxlarniOch(out, til);
  out = qisqartmalarniOch(out, til);
  out = sonlarniOch(out, til);
  out = apostrof(out);
  return out.replace(/\s{2,}/g, ' ').trim();
}
