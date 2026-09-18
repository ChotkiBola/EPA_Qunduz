import type { Til } from './normalize';

/**
 * Ovoz sozlamalari (brief v4 §2.1).
 *
 * Bitta joyda turadi — rate/pitch quloq bilan sinab tanlanadi va keyin ham
 * o'zgarishi mumkin, kodga tarqalib ketmasligi kerak.
 *
 * uz-UZ-SardorNeural ruscha gapira olmaydi — u faqat o'zbek tili uchun
 * o'qitilgan, shuning uchun har til uchun alohida ovoz. Ikki ovoz bir xil
 * odamga o'xshamaydi; mijoz bir seansda bitta tildan foydalangani uchun
 * bu sezilmaydi.
 */
export const OVOZLAR: Record<Til, { voice: string; rate: string; pitch: string }> = {
  uz: { voice: 'uz-UZ-SardorNeural', rate: '+10%', pitch: '+0Hz' },
  ru: { voice: 'ru-RU-DmitryNeural', rate: '+8%', pitch: '+0Hz' },
};

/** Eski nom — oldingi kod hali shunga murojaat qilsa buzilmasin. */
export const OVOZ_SOZLAMALARI = OVOZLAR.uz;

export { apostrof as ovozUchunTayyorla } from './normalize';
