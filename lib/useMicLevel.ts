'use client';

import { useCallback, useMemo, useRef } from 'react';

/**
 * Mikrofon amplitudasi (brief v3 §2.2).
 *
 * SpeechRecognition matn beradi, lekin ovoz darajasini bermaydi — halqalar
 * gapirishga javob berishi uchun mikrofon oqimini alohida AnalyserNode
 * orqali o'tkazish kerak. Ikkalasi bir vaqtda bitta mikrofondan foydalanadi;
 * brauzer buni qo'llab-quvvatlaydi.
 *
 * Ruxsat allaqachon SpeechRecognition uchun so'ralgan bo'ladi, shuning uchun
 * odatda ikkinchi so'rov chiqmaydi. Rad etilsa — jimgina qaytamiz: matn
 * tanish baribir ishlaydi, faqat halqalar jim turadi.
 */
export function useMicLevel(levelRef: React.RefObject<number>) {
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const smoothRef = useRef(0);

  const stop = useCallback(() => {
    /* Faol analizator bo'lmasa, hech narsaga tegmaymiz. Busiz gapirish
       paytidagi har bir render levelRef ni nolga tushirib, og'izni bir
       kadrga yopib qo'yardi. */
    if (!ctxRef.current) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    smoothRef.current = 0;
    levelRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void ctxRef.current.close();
    ctxRef.current = null;
  }, [levelRef]);

  const start = useCallback(async () => {
    if (ctxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      // Ataylab destination ga ulanmaydi — aks holda mijoz o'z ovozini
      // karnaydan eshitadi va akustik qaytish hosil bo'ladi.

      const buf = new Uint8Array(analyser.fftSize);
      const frame = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        // TTS bilan bir xil kuchaytirish, shunda halqalar ikkala holatda
        // bir xil kuchda harakatlanadi.
        const target = Math.min(1, Math.sqrt(sum / buf.length) * 8);
        const k = target > smoothRef.current ? 0.45 : 0.16;
        smoothRef.current += (target - smoothRef.current) * k;
        levelRef.current = smoothRef.current;
        rafRef.current = requestAnimationFrame(frame);
      };
      rafRef.current = requestAnimationFrame(frame);
    } catch {
      // Ruxsat yo'q yoki qurilma yo'q — halqalar jim, tanish davom etadi.
      stop();
    }
  }, [levelRef, stop]);

  // Barqaror havola — aks holda effekt bog'liqligi har renderda o'zgaradi
  return useMemo(() => ({ start, stop }), [start, stop]);
}
