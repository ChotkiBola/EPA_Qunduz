'use client';

import { useCallback, useEffect, useRef } from 'react';

type Options = {
  /** Written every frame with the smoothed audio level, 0–1. */
  levelRef: React.RefObject<number>;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

/**
 * Plays /api/tts audio and drives the mouth from the real waveform, per
 * brief §7.1 — an AnalyserNode over the playing element, smoothed RMS,
 * normalised to 0–1. No synthetic oscillator: there is no browser-speech
 * fallback to need one.
 */
export function useTts({ levelRef, onStart, onEnd, onError }: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef(0);
  const smoothRef = useRef(0);

  /* One element and one MediaElementSource for the whole session:
     createMediaElementSource throws if called twice on the same element,
     and a fresh element per utterance would leak nodes. */
  const ensureGraph = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      audioRef.current = el;
    }
    if (!ctxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaElementSource(audioRef.current).connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      bufRef.current = new Uint8Array(analyser.fftSize);
    }
    return { audio: audioRef.current, ctx: ctxRef.current };
  }, []);

  const stopMeter = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    smoothRef.current = 0;
    levelRef.current = 0;
  }, [levelRef]);

  const meter = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    if (!analyser || !buf) return;

    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);

    /* Gain measured against real ash-voice output, not guessed: 3.6 peaked at
       0.43 so the mouth never fully opened, and 10 pinned 3% of frames at 1.0
       so it looked stuck. 8 peaks at 0.93 with no clipping. Attack fast,
       release slow, otherwise the jaw chatters between syllables. */
    const target = Math.min(1, rms * 8);
    const k = target > smoothRef.current ? 0.45 : 0.16;
    smoothRef.current += (target - smoothRef.current) * k;
    levelRef.current = smoothRef.current;

    rafRef.current = requestAnimationFrame(meter);
  }, [levelRef]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    stopMeter();
  }, [stopMeter]);

  const speak = useCallback(
    async (text: string, speed = 1, til?: 'uz' | 'ru') => {
      const clean = text.trim();
      if (!clean) return;

      const { audio, ctx } = ensureGraph();
      // Autoplay policy parks the context until a gesture unlocks it.
      if (ctx.state === 'suspended') await ctx.resume();

      stop();
      /* Til serverga uzatiladi: javob ruscha bo'lsa ruscha ovoz kerak, va
         SardorNeural ruscha gapira olmaydi. Berilmasa server matndan o'zi
         aniqlaydi. */
      audio.src =
        `/api/tts?text=${encodeURIComponent(clean)}` + (til ? `&til=${til}` : '');
      audio.playbackRate = speed;

      return new Promise<void>((resolve) => {
        const done = () => {
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', fail);
          stopMeter();
          onEnd?.();
          resolve();
        };
        const fail = () => {
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', fail);
          stopMeter();
          onError?.('Ovozni ijro etib bo‘lmadi.');
          onEnd?.();
          resolve();
        };

        audio.addEventListener('ended', done);
        audio.addEventListener('error', fail);

        audio
          .play()
          .then(() => {
            onStart?.();
            if (!rafRef.current) meter();
          })
          .catch((err: unknown) => {
            // A blocked autoplay is not an error worth shouting about — the
            // answer is already on screen.
            audio.removeEventListener('ended', done);
            audio.removeEventListener('error', fail);
            stopMeter();
            if (err instanceof Error && err.name !== 'NotAllowedError') {
              onError?.(err.message);
            }
            onEnd?.();
            resolve();
          });
      });
    },
    [ensureGraph, meter, onEnd, onError, onStart, stop, stopMeter],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      void ctxRef.current?.close();
    },
    [],
  );

  return { speak, stop };
}
