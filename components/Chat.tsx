'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTil } from '@/lib/useTil';
import type { Card, ChatResponse } from '@/lib/types';
import type { Til } from '@/lib/normalize';

/* Bu fayl ataylab ovozga tegmaydi: useTts, useSpeechRecognition, Orb va
   Qunduz import qilinmaydi, shuning uchun /chat bundle'iga TTS, Web Audio
   va rig kodi umuman tushmaydi (brief v4 §4, §7). */

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  cards?: Card[];
  oqmoqda?: boolean;
};

const MATN = {
  uz: {
    salom: 'Assalomu alaykum! Sizga qanday uskuna kerak?',
    joy: 'Savolingizni yozing…',
    yubor: 'Yuborish',
    xato: 'Xatolik',
    qayta: 'Qayta urinish',
    siz: 'Siz',
    eskirgan: 'Narx maʼlumoti bir haftadan eski — oʻzgargan boʻlishi mumkin.',
    chiplar: [
      'Beton devorni teshish uchun nima kerak?',
      'Quduqdan suv chiqaradigan nasos',
      'Metall kesish uchun bolgarka',
    ],
  },
  ru: {
    salom: 'Здравствуйте! Какой инструмент вам нужен?',
    joy: 'Напишите ваш вопрос…',
    yubor: 'Отправить',
    xato: 'Ошибка',
    qayta: 'Повторить',
    siz: 'Вы',
    eskirgan: 'Данные о ценах старше недели — цена могла измениться.',
    chiplar: [
      'Чем сверлить бетонную стену?',
      'Насос для скважины',
      'Болгарка для резки металла',
    ],
  },
} as const;

export default function Chat() {
  const [tanlangan, tanla] = useTil();
  const til: Til = tanlangan ?? 'uz';
  const t = MATN[til];

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; savol: string } | null>(null);
  const [eskirgan, setEskirgan] = useState(false);

  const oxir = useRef<HTMLDivElement>(null);
  useEffect(() => {
    oxir.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const send = useCallback(
    async (xom: string) => {
      const savol = xom.trim();
      if (!savol || busy) return;

      setError(null);
      setInput('');
      setBusy(true);

      const history = messages.map(({ role, content }) => ({ role, content }));
      setMessages((p) => [
        ...p,
        { role: 'user', content: savol },
        { role: 'assistant', content: '', oqmoqda: true },
      ]);

      const yangila = (fn: (m: Msg) => Msg) =>
        setMessages((p) => {
          const n = [...p];
          const i = n.length - 1;
          if (n[i]?.role === 'assistant') n[i] = fn(n[i]);
          return n;
        });

      try {
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: savol, history, til }),
        });

        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Server xatosi (${res.status}).`);
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let bufer = '';
        let xatoMatn: string | null = null;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bufer += dec.decode(value, { stream: true });

          // SSE bloklari bo'sh qator bilan ajratiladi
          const bloklar = bufer.split('\n\n');
          bufer = bloklar.pop() ?? '';

          for (const blok of bloklar) {
            const turi = blok.match(/^event: (.+)$/m)?.[1];
            const data = blok.match(/^data: (.+)$/m)?.[1];
            if (!turi || !data) continue;
            const j = JSON.parse(data);

            if (turi === 'matn') {
              yangila((m) => ({ ...m, content: m.content + j.qism }));
            } else if (turi === 'tugadi') {
              yangila((m) => ({
                ...m,
                content: j.javob,
                cards: (j as ChatResponse).mahsulotlar ?? [],
                oqmoqda: false,
              }));
              setEskirgan(!!j.malumot?.eskirgan);
            } else if (turi === 'xato') {
              xatoMatn = j.error;
            }
          }
        }

        if (xatoMatn) throw new Error(xatoMatn);
      } catch (err) {
        // Yiqilgan navbat tarixdan tushadi, aks holda keyingi kontekstni buzadi
        setMessages((p) => {
          const n = [...p];
          if (n[n.length - 1]?.role === 'assistant') n.pop();
          if (n[n.length - 1]?.role === 'user') n.pop();
          return n;
        });
        setError({ text: err instanceof Error ? err.message : String(err), savol });
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, til],
  );

  return (
    <main className="mx-auto flex h-dvh max-w-2xl flex-col bg-tub text-qor">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/5 px-4 py-3">
        <span className="mono-chip rounded-md bg-epa px-2 py-1 text-[11px] tracking-widest text-white">
          EPA
        </span>
        <span className="font-display text-base font-extrabold">Qunduz</span>

        <div className="ml-auto flex overflow-hidden rounded-full border border-white/10">
          {(['uz', 'ru'] as const).map((k) => (
            <button
              key={k}
              onClick={() => tanla(k)}
              aria-pressed={til === k}
              className={`px-3 py-1.5 text-xs font-bold uppercase transition ${
                til === k ? 'bg-suv text-tub' : 'text-xira hover:text-qor'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <>
            <p className="text-sm text-xira">{t.salom}</p>
            <div className="flex flex-wrap gap-2">
              {t.chiplar.map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="rounded-full border border-white/10 bg-tub2 px-3 py-2 text-xs text-xira transition hover:border-suv/30 hover:text-qor"
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <p className="mono-chip mb-1 text-[10px] uppercase tracking-wider text-xira">
              {m.role === 'user' ? t.siz : 'Qunduz'}
            </p>
            <p
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-tub3 text-qor' : 'bg-tub2 text-qor'
              }`}
            >
              {m.content}
              {m.oqmoqda && <span className="ml-0.5 animate-dot-pulse">▍</span>}
            </p>

            {!!m.cards?.length && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {m.cards.map((c) => (
                  <a
                    key={c.s}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 gap-3 rounded-2xl border border-white/5 bg-tub2 p-3 text-left transition hover:border-suv/30 hover:bg-tub3"
                  >
                    <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-tub">
                      {c.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.img} alt="" loading="lazy" className="h-full w-full object-contain" />
                      ) : (
                        <span className="mono-chip text-[10px] text-xira">EPA</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.n}</span>
                      <span className="mono-chip block text-[11px] text-yogoch-och">{c.s}</span>
                      {c.narx && (
                        <span className="mt-1 block text-sm font-bold text-qor">{c.narx}</span>
                      )}
                      <span
                        className={`mt-0.5 block text-[11px] ${c.omborda ? 'text-suv' : 'text-xira'}`}
                      >
                        {c.ombor}
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}

        {eskirgan && (
          <p className="text-center text-[11px] text-yogoch-och/80">{t.eskirgan}</p>
        )}

        {error && (
          <div className="rounded-2xl border border-epa/40 bg-epa/10 p-3">
            <p className="text-sm font-semibold">{t.xato}</p>
            <p className="mt-1 break-words text-sm text-xira">{error.text}</p>
            <button
              onClick={() => send(error.savol)}
              className="mt-2 rounded-full bg-epa px-4 py-2 text-sm font-bold text-white hover:brightness-110"
            >
              {t.qayta}
            </button>
          </div>
        )}

        <div ref={oxir} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex shrink-0 items-center gap-2 border-t border-white/5 px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.joy}
          aria-label={t.joy}
          disabled={busy}
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-tub2 px-4 py-3 text-sm placeholder:text-xira/70 focus:border-suv/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label={t.yubor}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-epa text-white transition hover:brightness-110 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </main>
  );
}
