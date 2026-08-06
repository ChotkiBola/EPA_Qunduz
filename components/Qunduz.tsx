'use client';

import { useEffect, useRef } from 'react';

/* Rig geometry — LOCKED, measured from the artwork (brief §7.1).
   Both PNG layers are 558 x 617 and share one origin, so both draw at (0,0). */
const W = 558;
const H = 617;

const EYE_CY = 198.0;
const EYE_R = 23.8;
const EYE_L_CX = 186.5;
const EYE_R_CX = 325.4;
const EYE_TOP = EYE_CY - EYE_R; // lid closes downward from here

const MOUTH_CX = 255.6;
const MOUTH_TOP = 325.4; // top edge stays pinned under the teeth

const TAIL_PIVOT_X = 413.3;
const TAIL_PIVOT_Y = 507.6;

const FEET_X = 278.6; // whole-body scale pivot
const FEET_Y = 609.8;

const FUR = '#B66536'; // eyelid fill — fur colour around the eyes
const MOUTH_FILL = '#41180F';
const TONGUE_FILL = '#C0564F';

export type QunduzProps = {
  /** Mouth openness 0–1, read every frame. Audio-driven once TTS lands. */
  getOpen?: () => number;
  /** Adds the faster tail flick while Qunduz is talking. */
  getSpeaking?: () => boolean;
  className?: string;
};

export default function Qunduz({ getOpen, getSpeaking, className }: QunduzProps) {
  const bodyRef = useRef<SVGGElement>(null);
  const tailRef = useRef<SVGGElement>(null);
  const mouthRef = useRef<SVGEllipseElement>(null);
  const tongueRef = useRef<SVGEllipseElement>(null);
  const lidLRef = useRef<SVGEllipseElement>(null);
  const lidRRef = useRef<SVGEllipseElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let raf = 0;
    let start = 0;
    let nextBlink = 0;
    let blinkStart = -1;

    const setLids = (phase: number) => {
      // phase 0 = open, 1 = fully closed
      const ry = EYE_R * phase;
      const cy = EYE_TOP + ry;
      for (const lid of [lidLRef.current, lidRRef.current]) {
        if (!lid) continue;
        lid.setAttribute('ry', String(ry));
        lid.setAttribute('cy', String(cy));
      }
    };

    const setMouth = (open: number) => {
      const ry = open * 27;
      const rx = 30 + open * 13;
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

    const freeze = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      bodyRef.current?.setAttribute('transform', '');
      tailRef.current?.setAttribute('transform', '');
      setLids(0);
      setMouth(0);
    };

    const frame = (now: number) => {
      if (!start) {
        start = now;
        nextBlink = now + 1200 + Math.random() * 2000;
      }
      const t = (now - start) / 1000;

      // Breathe about the feet pivot, plus a ~1px sway.
      const sy = 1 + Math.sin(t * 1.55) * 0.014;
      const sway = Math.sin(t * 0.77);
      bodyRef.current?.setAttribute(
        'transform',
        `translate(${sway.toFixed(3)} 0) translate(${FEET_X} ${FEET_Y}) scale(1 ${sy.toFixed(5)}) translate(${-FEET_X} ${-FEET_Y})`,
      );

      // Tail sway, faster flick while speaking.
      const speaking = getSpeaking?.() ?? false;
      const tailDeg =
        Math.sin(t * 1.9) * 2.2 + (speaking ? Math.sin(t * 8) * 1.6 : 0);
      tailRef.current?.setAttribute(
        'transform',
        `rotate(${tailDeg.toFixed(3)} ${TAIL_PIVOT_X} ${TAIL_PIVOT_Y})`,
      );

      // Blink: 150ms close-open, every 2.4–6.6s.
      if (blinkStart < 0 && now >= nextBlink) blinkStart = now;
      if (blinkStart >= 0) {
        const p = (now - blinkStart) / 150;
        if (p >= 1) {
          blinkStart = -1;
          nextBlink = now + 2400 + Math.random() * 4200;
          setLids(0);
        } else {
          setLids(Math.sin(p * Math.PI));
        }
      }

      setMouth(Math.max(0, Math.min(1, getOpen?.() ?? 0)));

      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      if (reduce.matches) {
        freeze();
      } else if (!raf) {
        start = 0;
        blinkStart = -1;
        raf = requestAnimationFrame(frame);
      }
    };

    sync();
    reduce.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(raf);
      reduce.removeEventListener('change', sync);
    };
  }, [getOpen, getSpeaking]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="Qunduz — EPA sun’iy intellekt sotuvchisi"
      overflow="visible"
    >
      <g ref={bodyRef}>
        {/* z-order bottom → top: tail, body, mouth, tongue, eyelids */}
        <g ref={tailRef}>
          <image href="/qunduz-tail.png" x={0} y={0} width={W} height={H} />
        </g>
        <image href="/qunduz-body.png" x={0} y={0} width={W} height={H} />
        <ellipse
          ref={mouthRef}
          cx={MOUTH_CX}
          cy={MOUTH_TOP}
          rx={30}
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
    </svg>
  );
}
