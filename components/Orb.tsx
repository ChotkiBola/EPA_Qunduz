'use client';

import { useEffect, useRef } from 'react';
import Qunduz from './Qunduz';

type OrbProps = {
  /** 0–1 mouth/audio level, read every frame. Audio-driven once TTS lands. */
  getLevel: () => number;
  speaking: boolean;
  /** Mic is open — rings turn EPA red and pulse. */
  listening: boolean;
};

const RINGS = [
  { inset: '-6%', base: 1, gain: 0.05, opacity: 0.5 },
  { inset: '-16%', base: 1, gain: 0.09, opacity: 0.3 },
  { inset: '-27%', base: 1, gain: 0.13, opacity: 0.16 },
];

export default function Orb({ getLevel, speaking, listening }: OrbProps) {
  const ringRefs = useRef<(HTMLDivElement | null)[]>([]);
  const speakingRef = useRef(speaking);
  const listeningRef = useRef(listening);
  speakingRef.current = speaking;
  listeningRef.current = listening;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;

    const frame = (now: number) => {
      const level = Math.max(0, Math.min(1, getLevel()));
      // While the mic is live the rings breathe on their own so the user can
      // see the app is listening even in silence.
      const pulse = listeningRef.current
        ? (Math.sin(now / 260) + 1) / 2
        : 0;

      RINGS.forEach((ring, i) => {
        const el = ringRefs.current[i];
        if (!el) return;
        const drive = speakingRef.current ? level : pulse * 0.55;
        el.style.transform = `scale(${(ring.base + drive * ring.gain).toFixed(4)})`;
      });

      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches) {
        ringRefs.current.forEach((el) => el && (el.style.transform = ''));
      } else {
        raf = requestAnimationFrame(frame);
      }
    };

    sync();
    reduce.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(raf);
      reduce.removeEventListener('change', sync);
    };
  }, [getLevel]);

  return (
    <div className="relative mx-auto aspect-square w-full">
      {/* soft glow behind everything */}
      <div
        aria-hidden
        className="absolute inset-[-30%] -z-10 rounded-full blur-3xl transition-colors duration-500"
        style={{
          background: listening
            ? 'radial-gradient(circle, rgba(226,41,41,0.30), rgba(8,25,28,0) 68%)'
            : 'radial-gradient(circle, rgba(143,203,191,0.26), rgba(8,25,28,0) 68%)',
        }}
      />

      {RINGS.map((ring, i) => (
        <div
          key={i}
          aria-hidden
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          className="absolute rounded-full border transition-colors duration-500 will-change-transform"
          style={{
            inset: ring.inset,
            opacity: ring.opacity,
            borderColor: listening ? 'var(--epa)' : 'var(--suv)',
          }}
        />
      ))}

      <Qunduz
        getOpen={getLevel}
        getSpeaking={() => speakingRef.current}
        className="absolute inset-0 h-full w-full drop-shadow-2xl"
      />
    </div>
  );
}
