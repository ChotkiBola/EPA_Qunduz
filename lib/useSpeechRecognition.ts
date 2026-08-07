'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* The Web Speech API is not in the DOM typings, and the vendor-prefixed name
   is the one that actually exists in Chrome. Only the bits used here. */
type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResult };
};
type SpeechRecognitionErrorEvent = { error: string };

type SpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type Ctor = new () => SpeechRecognition;

const getCtor = (): Ctor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: Ctor;
    webkitSpeechRecognition?: Ctor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Chrome's own wording is terse and English; these are what the user sees. */
const ERRORS: Record<string, string> = {
  'not-allowed': 'Mikrofonga ruxsat berilmadi.',
  'service-not-allowed': 'Mikrofonga ruxsat berilmadi.',
  'no-speech': 'Ovoz eshitilmadi, qaytadan urinib ko‘ring.',
  'audio-capture': 'Mikrofon topilmadi.',
  network: 'Tarmoq xatosi — nutqni tanib bo‘lmadi.',
  aborted: '',
};

type Options = {
  /** Fired as the user speaks, so the input can show the words live. */
  onInterim: (text: string) => void;
  /** Fired once on end with the final transcript, if there was any. */
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
};

export function useSpeechRecognition({
  onInterim,
  onFinal,
  onError,
}: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  const recRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef('');
  const cancelledRef = useRef(false);

  // Detect after mount: the server has no window, and a mismatch would
  // otherwise flip the button's disabled state during hydration.
  useEffect(() => {
    setSupported(!!getCtor() && window.isSecureContext);
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  /** Abandon what was heard instead of sending it. */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current) return;

    const rec = new Ctor();
    rec.lang = 'uz-UZ';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    finalRef.current = '';
    cancelledRef.current = false;

    rec.onstart = () => setListening(true);

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      onInterim(`${finalRef.current}${interim}`.trim());
    };

    rec.onerror = (e) => {
      const message = ERRORS[e.error] ?? `Mikrofon xatosi: ${e.error}`;
      if (message) onError?.(message);
      cancelledRef.current = true; // onend follows; do not submit noise
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = finalRef.current.trim();
      finalRef.current = '';
      if (!cancelledRef.current && text) onFinal(text);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, [onError, onFinal, onInterim]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, start, stop, cancel };
}
