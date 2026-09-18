import { createHash } from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { NextResponse } from 'next/server';
import { OVOZLAR } from '@/lib/ovoz';
import { ovozgaTayyorla, tilniAniqla, type Til } from '@/lib/normalize';

export const runtime = 'nodejs';

const MAX_CHARS = 900; // answers are 2–4 sentences; anything longer is a bug

/* Measured typical synthesis is 1–2s, but one run in a warm-up batch stalled
   for 91s. Without a ceiling that becomes a hung serverless invocation, so the
   socket gets a deadline and the UI falls back to text. */
const TIMEOUT_MS = 12000;

/** Covers the whole synthesis, including setMetadata — that opens the socket
    and is where a stall was actually observed, outside a stream-only guard. */
async function withDeadline<T>(work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(String(TIMEOUT_MS / 1000) + 's ichida javob kelmadi')),
      TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([work(), limit]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Same text, same audio — and the greeting plus the price refusal repeat
 * constantly. A warm instance serves those without hitting the service again,
 * and the immutable Cache-Control lets the browser and Vercel's CDN do the
 * same, which is what §5.3 asks for.
 */
const cache = new Map<string, Buffer>();
const CACHE_MAX = 60;

function remember(key: string, buf: Buffer) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, buf);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

const audioResponse = (buf: Buffer, hit: boolean) =>
  new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'audio/mpeg',
      'content-length': String(buf.length),
      'cache-control': 'public, max-age=31536000, immutable',
      'x-tts-cache': hit ? 'hit' : 'miss',
    },
  });

/** One socket per synthesis; a shared one would interleave concurrent turns. */
async function synthesise(text: string, til: Til): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    return await withDeadline(async () => {
      await tts.setMetadata(
        OVOZLAR[til].voice,
        OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
      );
      const { audioStream } = tts.toStream(text, {
        rate: OVOZLAR[til].rate,
        pitch: OVOZLAR[til].pitch,
      });

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        audioStream.on('data', (c: Buffer) => chunks.push(c));
        audioStream.on('end', () => resolve());
        audioStream.on('error', (e: Error) => reject(e));
      });

      const buf = Buffer.concat(chunks);
      if (buf.length === 0) throw new Error('bo‘sh audio qaytdi');
      return buf;
    });
  } finally {
    try {
      tts.close();
    } catch {
      // the socket may already be gone; nothing to do about it
    }
  }
}

export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get('text') ?? '').trim();

  if (!raw) {
    return NextResponse.json({ error: 'Matn bo‘sh.' }, { status: 400 });
  }
  if (raw.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Matn juda uzun (${raw.length} > ${MAX_CHARS}).` },
      { status: 400 },
    );
  }

  /* Til: ochiq berilgani ustun, aks holda yozuvdan aniqlanadi. Bu yerda
     aniqlash xom matndan qilinadi — normalizatsiya kirill birliklarni
     o'zbekchaga aylantirib, nisbatni buzib yuborardi. */
  const soralgan = new URL(req.url).searchParams.get('til');
  const til: Til = soralgan === 'ru' || soralgan === 'uz' ? soralgan : tilniAniqla(raw);

  /* Butun normalizatsiya quvuri (v4 §3): model kodlari, narxlar,
     qisqartmalar, sonlar, apostrof. Ekran matni tegilmaydi — bu faqat
     ovozga ketadigan nusxa. */
  const text = ovozgaTayyorla(raw, til);

  const ovoz = OVOZLAR[til];
  const key = createHash('sha256')
    .update(`${ovoz.voice}|${ovoz.rate}|${ovoz.pitch}|${text}`)
    .digest('hex');

  const hit = cache.get(key);
  if (hit) return audioResponse(hit, true);

  try {
    const buf = await synthesise(text, til);
    remember(key, buf);
    return audioResponse(buf, false);
  } catch (err) {
    // The answer is already on screen; the UI degrades to text-only rather
    // than losing it, so this error just needs to be legible.
    return NextResponse.json(
      { error: `Ovoz xizmati: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
