'use client';

import Qunduz from './Qunduz';
import type { AvatarState } from '@/lib/types';

type OrbProps = {
  /** 0–1 audio level, read every frame while speaking. */
  getLevel: () => number;
  state: AvatarState;
};

/* Each ring reacts a little more than the one inside it, and starts its idle
   fade at a different point so the three never breathe in lockstep. */
const RINGS = [
  { inset: '-6%', kuch: 0.05, kechikish: '0s' },
  { inset: '-16%', kuch: 0.09, kechikish: '-2.6s' },
  { inset: '-27%', kuch: 0.13, kechikish: '-5.2s' },
];

const GLOW: Record<AvatarState, string> = {
  idle: 'radial-gradient(circle, rgba(143,203,191,0.20), rgba(8,25,28,0) 68%)',
  listening: 'radial-gradient(circle, rgba(226,41,41,0.30), rgba(8,25,28,0) 68%)',
  thinking: 'radial-gradient(circle, rgba(143,203,191,0.16), rgba(8,25,28,0) 68%)',
  speaking: 'radial-gradient(circle, rgba(143,203,191,0.28), rgba(8,25,28,0) 68%)',
};

export default function Orb({ getLevel, state }: OrbProps) {
  return (
    <div
      className="relative mx-auto aspect-square w-full"
      data-holat={state}
    >
      <div
        aria-hidden
        className="absolute inset-[-30%] -z-10 rounded-full blur-3xl transition-[background] duration-500"
        style={{ background: GLOW[state] }}
      />

      {RINGS.map((ring, i) => (
        <div
          key={i}
          aria-hidden
          className="orb-halqa"
          style={
            {
              inset: ring.inset,
              '--halqa-kuch': ring.kuch,
              '--halqa-kechikish': ring.kechikish,
            } as React.CSSProperties
          }
        />
      ))}

      <Qunduz
        getOpen={getLevel}
        state={state}
        className="absolute inset-0 h-full w-full drop-shadow-2xl"
      />
    </div>
  );
}
