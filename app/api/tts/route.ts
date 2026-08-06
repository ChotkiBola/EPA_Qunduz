import { createHash } from 'node:crypto';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MODEL = 'gpt-4o-mini-tts';
const VOICE = 'ash'; // chosen by ear against Uzbek samples — see README
const MAX_CHARS = 900; // answers are 2–4 sentences; anything longer is a bug

/**
 * Same text, same audio — and the greeting plus the common refusals repeat
 * constantly. A warm instance serves those without paying OpenAI again, and
 * the immutable Cache-Control lets the browser and Vercel's CDN do the same.
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

export async function GET(req: Request) {
  const text = (new URL(req.url).searchParams.get('text') ?? '').trim();

  if (!text) {
    return NextResponse.json({ error: 'Matn bo‘sh.' }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Matn juda uzun (${text.length} > ${MAX_CHARS}).` },
      { status: 400 },
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY sozlanmagan.' },
      { status: 500 },
    );
  }

  const key = createHash('sha256').update(`${MODEL}|${VOICE}|${text}`).digest('hex');
  const hit = cache.get(key);
  if (hit) return audioResponse(hit, true);

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await client.audio.speech.create({
      model: MODEL,
      voice: VOICE,
      input: text,
      response_format: 'mp3',
    });

    const buf = Buffer.from(await speech.arrayBuffer());
    remember(key, buf);
    return audioResponse(buf, false);
  } catch (err) {
    // The answer is already on screen; the UI degrades to text-only rather
    // than losing it, so this error just needs to be legible.
    if (err instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI TTS: ${err.message}` },
        { status: err.status ?? 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
