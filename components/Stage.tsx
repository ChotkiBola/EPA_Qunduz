'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Orb from './Orb';
import ProductCard from './ProductCard';
import Sheet from './Sheet';
import { GREETING, PHONE, STARTERS } from '@/lib/copy';
import { useTts } from '@/lib/useTts';
import { useSpeechRecognition } from '@/lib/useSpeechRecognition';
import type { Card, ChatResponse } from '@/lib/types';

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  cards?: Card[];
};

type Status = 'idle' | 'thinking' | 'listening' | 'speaking';

const STATUS_LABEL: Record<Exclude<Status, 'idle'>, string> = {
  thinking: 'o’ylayapti',
  listening: 'eshityapti',
  speaking: 'gapiryapti',
};

export default function Stage() {
  const router = useRouter();

  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: GREETING },
  ]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<{ text: string; question: string } | null>(
    null,
  );
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  /* Mouth/ring drive — written every frame by the TTS analyser. */
  const levelRef = useRef(0);
  const getLevel = useCallback(() => levelRef.current, []);

  /* One line for both voice-side notices: a TTS failure or a mic problem is
     an aside, not the error card that replaces the answer. */
  const [notice, setNotice] = useState<string | null>(null);
  const { speak, stop: stopVoice } = useTts({
    levelRef,
    onStart: () => setStatus('speaking'),
    onEnd: () => setStatus('idle'),
    onError: setNotice,
  });

  const sendRef = useRef<(text: string) => void>(() => {});
  const mic = useSpeechRecognition({
    onInterim: setInput,
    onFinal: (text) => sendRef.current(text),
    onError: setNotice,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const busy = status === 'thinking';

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const asked = messages.some((m) => m.role === 'user');

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || busy) return;

      setError(null);
      setInput('');
      setStatus('thinking');

      // History as the model should see it, before this question is added.
      const history = messages.map(({ role, content }) => ({ role, content }));
      setMessages((prev) => [...prev, { role: 'user', content: question }]);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: question, history }),
        });
        const data = (await res.json()) as ChatResponse & { error?: string };

        if (!res.ok || data.error) {
          throw new Error(data.error || `Server xatosi (${res.status}).`);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.javob,
            cards: data.mahsulotlar ?? [],
          },
        ]);

        setStatus('idle');
        if (!muted) {
          setNotice(null);
          await speak(data.javob, speed);
        }
      } catch (err) {
        // Drop the failed turn so it cannot poison later context.
        setMessages((prev) => {
          const next = [...prev];
          if (next[next.length - 1]?.role === 'user') next.pop();
          return next;
        });
        setStatus('idle');
        setError({
          text: err instanceof Error ? err.message : String(err),
          question,
        });
      }
    },
    [busy, messages, muted, speak, speed],
  );

  // The mic's onFinal fires from inside the hook, where `send` would be stale.
  useEffect(() => {
    sendRef.current = (text: string) => void send(text);
  }, [send]);

  // Listening is a status like any other, but must not overwrite "thinking".
  useEffect(() => {
    if (mic.listening) setStatus('listening');
    else setStatus((s) => (s === 'listening' ? 'idle' : s));
  }, [mic.listening]);

  /* The greeting should be heard, not just read. Browsers block audio that
     was not asked for, so this is best-effort: useTts swallows the block and
     the greeting simply stays on screen. */
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current || muted) return;
    greeted.current = true;
    void speak(GREETING, speed);
  }, [muted, speak, speed]);

  // Muting mid-sentence should actually stop the voice.
  useEffect(() => {
    if (muted) stopVoice();
  }, [muted, stopVoice]);

  // Esc closes the stage (the sheets swallow it first when they are open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <main
      className="flex h-dvh flex-col overflow-hidden text-qor"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 0%, #1B4A52 0%, #08191C 70%)',
      }}
    >
      {/* ---------------------------------------------------------- top bar */}
      <header className="flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6">
        <span className="mono-chip rounded-md bg-epa px-2 py-1 text-[11px] tracking-widest text-white">
          EPA
        </span>
        <span className="font-display text-lg font-extrabold">Qunduz</span>

        <div className="ml-auto flex items-center gap-1">
          <IconButton
            label={muted ? 'Ovozni yoqish' : 'Ovozni o’chirish'}
            active={muted}
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? <IconMuted /> : <IconSound />}
          </IconButton>
          <IconButton
            label="Suhbat tarixi"
            onClick={() => setShowTranscript(true)}
          >
            <IconTranscript />
          </IconButton>
          <IconButton label="Sozlamalar" onClick={() => setShowSettings(true)}>
            <IconSettings />
          </IconButton>
          <IconButton label="Yopish" onClick={() => router.push('/')}>
            <IconClose />
          </IconButton>
        </div>
      </header>

      {/* ------------------------------------------------------------- orb */}
      {/* overflow-x-hidden is deliberate: setting only overflow-y makes the
          browser compute overflow-x as auto, which would let a wide child
          scroll sideways instead of being caught in layout. */}
      <section className="flex flex-1 flex-col items-center justify-center gap-5 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6">
        {/* The orb gives way once there is an answer to read. */}
        <div
          className={`w-full shrink-0 transition-[max-width] duration-500 ${
            asked ? 'max-w-[min(38vw,190px)]' : 'max-w-[min(70vw,340px)]'
          }`}
        >
          <Orb
            getLevel={getLevel}
            speaking={status === 'speaking'}
            listening={status === 'listening'}
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <p
            aria-live="polite"
            className="mono-chip h-5 text-sm tracking-wide text-suv"
          >
            {status === 'idle' ? '' : STATUS_LABEL[status]}
          </p>
          {/* The answer still stands without audio, so a voice or mic failure
              is a note rather than the error card. */}
          {notice && <p className="text-xs text-yogoch-och/80">{notice}</p>}
        </div>

        {/* ------------------------------------------------- answer area */}
        <div className="w-full max-w-2xl text-center">
          {error ? (
            <div className="mx-auto max-w-lg rounded-2xl border border-epa/40 bg-epa/10 p-4">
              <p className="text-sm font-semibold text-qor">Xatolik</p>
              <p className="mt-1 break-words text-sm text-xira">{error.text}</p>
              <button
                onClick={() => send(error.question)}
                className="mt-3 rounded-full bg-epa px-4 py-2 text-sm font-bold text-white hover:brightness-110"
              >
                Qayta urinish
              </button>
            </div>
          ) : (
            <>
              {lastUser && (
                <p className="text-sm text-yogoch-och sm:text-base">
                  {lastUser.content}
                </p>
              )}
              <p className="mt-2 text-balance text-xl leading-snug sm:text-2xl">
                {lastAssistant?.content}
              </p>

              {!!lastAssistant?.cards?.length && (
                <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                  {lastAssistant.cards.map((c) => (
                    <ProductCard key={c.s} card={c} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* starter chips — only before the first question */}
          {!asked && !error && (
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-white/10 bg-tub2/70 px-3.5 py-2 text-xs text-xira transition hover:border-suv/30 hover:text-qor sm:text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- bottom bar */}
      <footer className="shrink-0 border-t border-white/5 bg-tub/80 px-4 py-3 backdrop-blur sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-2xl items-center gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mic.listening ? 'Gapiring…' : 'Savolingizni yozing…'}
            aria-label="Savolingizni yozing"
            disabled={busy}
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-tub2 px-4 py-3 text-sm text-qor placeholder:text-xira/70 focus:border-suv/40 disabled:opacity-60"
          />
          <button
            type="button"
            disabled={!mic.supported || busy}
            aria-label={mic.listening ? 'Mikrofonni to’xtatish' : 'Mikrofon'}
            aria-pressed={mic.listening}
            title={
              mic.supported
                ? mic.listening
                  ? 'To’xtatish'
                  : 'Gapirib ayting'
                : 'Ovozli kiritish Chrome brauzerida va HTTPS orqali ishlaydi'
            }
            onClick={() => {
              if (mic.listening) {
                mic.stop();
                return;
              }
              // Barge-in: the customer talking over Qunduz should silence him.
              stopVoice();
              setNotice(null);
              setInput('');
              mic.start();
            }}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition disabled:opacity-40 ${
              mic.listening
                ? 'animate-dot-pulse border-epa bg-epa text-white'
                : 'border-white/10 bg-tub2 text-xira hover:text-qor'
            }`}
          >
            <IconMic />
          </button>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Yuborish"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-epa text-white transition hover:brightness-110 disabled:opacity-40"
          >
            <IconSend />
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-xira">
          Narxlar uchun savdo bo’limi:{' '}
          <span className="mono-chip text-yogoch-och">{PHONE}</span>
        </p>
      </footer>

      {/* ------------------------------------------------------------ sheets */}
      <Sheet
        open={showTranscript}
        title="Suhbat tarixi"
        onClose={() => setShowTranscript(false)}
      >
        <ol className="space-y-4">
          {messages.map((m, i) => (
            <li key={i}>
              <p className="mono-chip text-[11px] uppercase tracking-wider text-xira">
                {m.role === 'user' ? 'Siz' : 'Qunduz'}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{m.content}</p>
              {!!m.cards?.length && (
                <p className="mono-chip mt-1 text-xs text-yogoch-och">
                  {m.cards.map((c) => c.s).join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Sheet>

      <Sheet
        open={showSettings}
        title="Sozlamalar"
        onClose={() => setShowSettings(false)}
      >
        <div className="space-y-5">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm">Ovoz o’chirilgan</span>
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => setMuted(e.target.checked)}
              className="h-5 w-5 accent-[color:var(--epa)]"
            />
          </label>

          <label className="block">
            <span className="flex items-center justify-between text-sm">
              O’qish tezligi
              <span className="mono-chip text-yogoch-och">
                {speed.toFixed(2)}×
              </span>
            </span>
            <input
              type="range"
              min={0.7}
              max={1.3}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="mt-2 w-full accent-[color:var(--suv)]"
            />
          </label>

          <p className="text-xs leading-relaxed text-xira">
            Ovoz sozlamalari o’zbekcha nutq yoqilganda kuchga kiradi.
          </p>
        </div>
      </Sheet>
    </main>
  );
}

/* ------------------------------------------------------------------ atoms */

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-10 w-10 place-items-center rounded-full transition hover:bg-white/10 ${
        active ? 'text-epa' : 'text-xira hover:text-qor'
      }`}
    >
      {children}
    </button>
  );
}

const svg = {
  className: 'h-5 w-5',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};

const IconSound = () => (
  <svg {...svg}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
const IconMuted = () => (
  <svg {...svg}>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="m16 9 5 6M21 9l-5 6" />
  </svg>
);
const IconTranscript = () => (
  <svg {...svg}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
const IconSettings = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </svg>
);
const IconClose = () => (
  <svg {...svg}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const IconMic = () => (
  <svg {...svg}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
const IconSend = () => (
  <svg {...svg}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);
