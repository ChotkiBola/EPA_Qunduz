'use client';

import { useEffect, useRef } from 'react';
import type { AvatarState } from '@/lib/types';

/* Rig geometry — measured from the artwork, unchanged from v2.
   Both PNG layers are 558 x 617 and share one origin, so both draw at (0,0). */
const W = 558;
const H = 617;

const EYE_CY = 198.0;
const EYE_R = 23.8;
const EYE_L_CX = 186.5;
const EYE_R_CX = 325.4;
const EYE_TOP = EYE_CY - EYE_R; // lid closes downward from the top of the eye

const MOUTH_CX = 255.6;
const MOUTH_TOP = 325.4; // top edge stays pinned under the teeth

const FUR = '#B66536';
const MOUTH_FILL = '#41180F';
const TONGUE_FILL = '#C0564F';

/* Blink, per brief v3 §2.1: 3–7s apart, 90ms shut, 130ms open, and every
   fifth blink comes as a pair — that irregularity is what reads as alive. */
const BLINK_MIN = 3000;
const BLINK_SPAN = 4000;
const BLINK_CLOSE = 90;
const BLINK_OPEN = 130;
const BLINK_TOTAL = BLINK_CLOSE + BLINK_OPEN;
const DOUBLE_EVERY = 5;
const DOUBLE_GAP = 120;

/* §2.4: the jaw must not drop past 60% of its travel, or the face reads as a
   puppet rather than a beaver. */
const JAW_LIMIT = 0.6;
const MOUTH_RY = 27;
const MOUTH_RX = 30;
const MOUTH_RX_GAIN = 13;

/** Whole-body lean. There is no separate head layer to rotate on its own. */
const TILT: Record<AvatarState, number> = {
  idle: 0,
  listening: -3,
  thinking: 4,
  speaking: 0,
};

export type QunduzProps = {
  /** Mouth openness 0–1, read every frame while speaking. */
  getOpen?: () => number;
  state?: AvatarState;
  className?: string;
};

export default function Qunduz({
  getOpen,
  state = 'idle',
  className,
}: QunduzProps) {
  const mouthRef = useRef<SVGEllipseElement>(null);
  const tongueRef = useRef<SVGEllipseElement>(null);
  const lidLRef = useRef<SVGEllipseElement>(null);
  const lidRRef = useRef<SVGEllipseElement>(null);

  const openRef = useRef(getOpen);
  openRef.current = getOpen;

  /* Blink runs on its own timer and only spins up rAF for the 220ms it is
     actually moving. Idle costs no JS at all — CSS owns breathing and tail. */
  useEffect(() => {
    const setLids = (phase: number) => {
      const ry = EYE_R * phase;
      const cy = EYE_TOP + ry;
      for (const lid of [lidLRef.current, lidRRef.current]) {
        if (!lid) continue;
        lid.setAttribute('ry', String(ry));
        lid.setAttribute('cy', String(cy));
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let blinks = 0;
    let cancelled = false;

    const animate = (done: () => void) => {
      const t0 = performance.now();
      const step = (now: number) => {
        if (cancelled) return;
        const t = now - t0;
        if (t >= BLINK_TOTAL) {
          setLids(0);
          done();
          return;
        }
        setLids(
          t < BLINK_CLOSE
            ? t / BLINK_CLOSE
            : 1 - (t - BLINK_CLOSE) / BLINK_OPEN,
        );
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const blink = (isPair: boolean) => {
      blinks += 1;
      animate(() => {
        if (!isPair && blinks % DOUBLE_EVERY === 0) {
          timer = setTimeout(() => blink(true), DOUBLE_GAP);
        } else {
          schedule();
        }
      });
    };

    const schedule = () => {
      timer = setTimeout(
        () => blink(false),
        BLINK_MIN + Math.random() * BLINK_SPAN,
      );
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* The mouth only needs a loop while there is audio to follow. */
  useEffect(() => {
    const setMouth = (open: number) => {
      const ry = open * MOUTH_RY;
      const rx = MOUTH_RX + open * MOUTH_RX_GAIN;
      const mouth = mouthRef.current;
      if (mouth) {
        mouth.setAttribute('ry', String(ry));
        mouth.setAttribute('rx', String(rx));
        mouth.setAttribute('cy', String(MOUTH_TOP + ry));
      }
      const tongue = tongueRef.current;
      if (tongue) {
        tongue.setAttribute('ry', String(ry * 0.3));
        tongue.setAttribute('rx', String(rx * 0.45));
        tongue.setAttribute('cy', String(MOUTH_TOP + ry * 1.55));
      }
    };

    if (state !== 'speaking') {
      setMouth(0);
      return;
    }

    let raf = 0;
    const frame = () => {
      const raw = openRef.current?.() ?? 0;
      setMouth(Math.max(0, Math.min(1, raw)) * JAW_LIMIT);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      setMouth(0);
    };
  }, [state]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="Qunduz — EPA sun’iy intellekt sotuvchisi"
      overflow="visible"
    >
      <g
        className="qunduz-egilish"
        style={{ transform: `rotate(${TILT[state]}deg)` }}
      >
        <g className="qunduz-nafas" data-holat={state}>
          {/* z-order bottom → top: tail, body, mouth, tongue, eyelids */}
          <g className="qunduz-dum">
            <image href="/qunduz-tail.png" x={0} y={0} width={W} height={H} />
          </g>
          <image href="/qunduz-body.png" x={0} y={0} width={W} height={H} />

          <ellipse
            ref={mouthRef}
            cx={MOUTH_CX}
            cy={MOUTH_TOP}
            rx={MOUTH_RX}
            ry={0}
            fill={MOUTH_FILL}
          />
          <ellipse
            ref={tongueRef}
            cx={MOUTH_CX}
            cy={MOUTH_TOP}
            rx={13.5}
            ry={0}
            fill={TONGUE_FILL}
          />
          <ellipse
            ref={lidLRef}
            cx={EYE_L_CX}
            cy={EYE_TOP}
            rx={EYE_R}
            ry={0}
            fill={FUR}
          />
          <ellipse
            ref={lidRRef}
            cx={EYE_R_CX}
            cy={EYE_TOP}
            rx={EYE_R}
            ry={0}
            fill={FUR}
          />
        </g>
      </g>
    </svg>
  );
}
