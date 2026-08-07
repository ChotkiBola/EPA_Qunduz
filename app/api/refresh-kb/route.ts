import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { kb } from '@/lib/kb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily catalogue refresh.
 *
 * The obvious implementation — scrape here and write data/kb.json — cannot
 * work: Vercel's filesystem is read-only at runtime, and /tmp is per-instance
 * and ephemeral, so instances would disagree about the catalogue. The file is
 * also a build-time import, which the search index and the landing page's
 * counts are built from.
 *
 * So this route does not scrape. It triggers a redeploy, and the build runs
 * `npm run scrape` (see the prebuild script) — every deployment ships a fresh
 * catalogue, baked in, identical across every instance.
 */
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: 'Ruxsat yo‘q.' }, { status: 401 });
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) {
    return NextResponse.json(
      {
        error:
          'VERCEL_DEPLOY_HOOK_URL sozlanmagan — qayta deploy chaqirib bo‘lmaydi.',
      },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(hook, { method: 'POST' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Deploy hook ${res.status} qaytardi.` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      triggered: true,
      // What the currently-running deployment was built with, so the next
      // run's numbers can be compared against it.
      hozirgi: { mahsulot: kb.items.length, kategoriya: kb.cats.length },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
