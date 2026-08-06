import Link from 'next/link';

/* Placeholder — the real stage (orb, chat, voice) is built in step 4.
   It exists now only so the landing CTA is not a dead link. */
export default function StagePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-tub px-6 text-center">
      <div>
        <p className="mono-chip text-xs uppercase tracking-[0.2em] text-suv">
          tez orada
        </p>
        <h1 className="mt-4 text-3xl">Qunduz sahnasi</h1>
        <p className="mt-3 text-xira">Ovozli rejim tayyorlanmoqda.</p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full border border-white/10 bg-tub2 px-5 py-3 text-sm font-semibold hover:bg-tub3"
        >
          Orqaga
        </Link>
      </div>
    </main>
  );
}
