'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Til } from './normalize';

const KALIT = 'qunduz-til';

/**
 * Til tanlovi (brief v4 §2.3).
 *
 * Tanlov localStorage da saqlanadi va uch manbadan birinchisi sifatida
 * ustun turadi — savol yozuvidan aniqlash faqat tanlov bo'lmaganda ishlaydi.
 * Boshlang'ich qiymat serverda ham, birinchi renderda ham bir xil ('uz'),
 * aks holda hidratsiya vaqtida mos kelmaydi.
 */
export function useTil(): [Til | null, (t: Til) => void] {
  const [til, setTil] = useState<Til | null>(null);

  useEffect(() => {
    try {
      const saqlangan = localStorage.getItem(KALIT);
      if (saqlangan === 'uz' || saqlangan === 'ru') setTil(saqlangan);
    } catch {
      // private rejimda localStorage otib yuborishi mumkin — tanlovsiz ishlaymiz
    }
  }, []);

  const tanla = useCallback((t: Til) => {
    setTil(t);
    try {
      localStorage.setItem(KALIT, t);
    } catch {
      // saqlanmasa ham joriy seansda ishlaydi
    }
  }, []);

  return [til, tanla];
}
