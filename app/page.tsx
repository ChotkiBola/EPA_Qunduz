import Link from 'next/link';
import Qunduz from '@/components/Qunduz';
import { kb } from '@/lib/kb';
import { PHONE } from '@/lib/copy';

const stats = [
  {
    value: kb.items.length.toLocaleString('uz-UZ'),
    label: 'mahsulot katalogda',
    note: 'artikul, xarakteristika va tavsif bilan',
  },
  {
    value: String(kb.cats.length),
    label: 'kategoriya',
    note: 'elektr asboblar, nasoslar, uskunalar',
  },
  {
    value: 'O’zbekcha',
    label: 'ovoz va matn',
    note: 'savolni yozing yoki shunchaki ayting',
  },
];

/* Timber "log" bars — the divider under the hero. */
const LOGS = [
  { w: 'w-[22%]', h: 'h-3', c: 'var(--yogoch)' },
  { w: 'w-[11%]', h: 'h-2', c: 'var(--yogoch-och)' },
  { w: 'w-[31%]', h: 'h-4', c: 'var(--yogoch)' },
  { w: 'w-[7%]', h: 'h-2', c: 'var(--suv)' },
  { w: 'w-[17%]', h: 'h-3', c: 'var(--yogoch-och)' },
  { w: 'w-[9%]', h: 'h-2', c: 'var(--yogoch)' },
];

export default function Home() {
  return (
    <main className="min-h-dvh bg-tub text-qor">
      {/* React hoists these into <head> — the hero artwork is the LCP element. */}
      <link rel="preload" as="image" href="/qunduz-body.png" />
      <link rel="preload" as="image" href="/qunduz-tail.png" />
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <header className="flex items-center gap-3">
          <span className="mono-chip rounded-md bg-epa px-2 py-1 text-xs tracking-widest text-white">
            EPA
          </span>
          <span className="text-sm text-xira">epa.uz</span>
        </header>

        {/* Hero */}
        <section className="mt-10 grid items-center gap-10 sm:mt-16 md:grid-cols-[1.05fr_0.95fr] md:gap-6">
          <div>
            <p className="mono-chip text-xs uppercase tracking-[0.2em] text-suv">
              epa.uz uchun prototip
            </p>
            <h1 className="mt-5 text-[clamp(2.75rem,11vw,5.5rem)] leading-[0.92]">
              Qunduz
              <span className="mt-1 block text-[clamp(1.5rem,5.5vw,2.6rem)] font-bold text-yogoch-och">
                savolga javob beradi
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-xira sm:text-lg">
              EPA katalogidagi {kb.items.length} ta mahsulot — perforator, nasos,
              bolgarka, qo’l asboblari. Qanday ish qilmoqchiligingizni ayting,
              Qunduz kerakli asbobni artikuli bilan topib beradi.
            </p>

            <Link
              href="/stage"
              className="group mt-9 inline-flex items-center gap-3 rounded-full bg-epa px-7 py-4 text-base font-bold text-white shadow-[0_10px_30px_-10px_rgba(226,41,41,0.8)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-dot-pulse rounded-full bg-white" />
              </span>
              Qunduz bilan gaplashish
            </Link>

            <p className="mt-4 text-sm text-xira">
              Mikrofon Chrome brauzerida ishlaydi. Narxlar uchun savdo bo’limi:{' '}
              <span className="mono-chip text-yogoch-och">{PHONE}</span>
            </p>
          </div>

          {/* Artwork */}
          <div className="relative mx-auto w-full max-w-[420px] md:max-w-none">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle at 50% 55%, rgba(143,203,191,0.22), rgba(14,42,47,0) 68%)',
              }}
            />
            <Qunduz className="w-full drop-shadow-2xl" />
          </div>
        </section>

        {/* Timber log divider */}
        <div
          aria-hidden
          className="mt-14 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-20"
        >
          {LOGS.map((log, i) => (
            <span
              key={i}
              className={`${log.w} ${log.h} rounded-full opacity-80`}
              style={{ background: log.c }}
            />
          ))}
        </div>

        {/* Stats */}
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/5 bg-tub2 p-6 transition hover:bg-tub3"
            >
              <div className="font-display text-4xl font-extrabold text-yogoch-och">
                {s.value}
              </div>
              <div className="mt-1 text-sm font-semibold text-qor">{s.label}</div>
              <div className="mt-2 text-sm leading-snug text-xira">{s.note}</div>
            </div>
          ))}
        </section>

        <footer className="mt-14 flex flex-col gap-2 border-t border-white/5 pt-6 text-sm text-xira sm:flex-row sm:items-center sm:justify-between">
          <p>
            Savdo bo’limi:{' '}
            <a
              href={`tel:${PHONE.replace(/[^+\d]/g, '')}`}
              className="mono-chip text-yogoch-och hover:text-qor"
            >
              {PHONE}
            </a>
          </p>
          <p>Qunduz — EPA sun’iy intellekt sotuvchisi prototipi</p>
        </footer>
      </div>
    </main>
  );
}
