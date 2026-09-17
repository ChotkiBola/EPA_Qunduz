/**
 * Ovoz sozlamalari va TTS uchun matn tayyorlash (brief v3 §5).
 *
 * Sozlamalar bitta joyda turadi — kodga tarqalib ketmasin, chunki rate/pitch
 * quloq bilan sinab tanlanadi va keyin ham o'zgarishi mumkin.
 */
export const OVOZ_SOZLAMALARI = {
  voice: 'uz-UZ-SardorNeural',
  rate: '+10%',
  pitch: '+0Hz',
} as const;

/**
 * Oddiy apostroflarni rasmiy oʻzbek belgisiga (ʻ, U+02BB) almashtiradi.
 *
 * Model "oʻ" va "gʻ" ni faqat shu belgi bilan to'g'ri talaffuz qiladi; oddiy
 * ' bilan ular buziladi. Faqat o va g harflaridan keyin ishlaydi, shuning
 * uchun "EPA'ning" kabi qo'shimchalarga tegmaydi.
 *
 * Ekrandagi matn o'zgarmaydi — faqat ovozga ketadigan nusxa tuzatiladi.
 * 940 ta mahsulot bazasida apostroflar turli ko'rinishda yozilgani uchun
 * bu majburiy qadam.
 */
const OG_APOSTROF = /([oOgG])['‘’ʼ`´]/g;

export function ovozUchunTayyorla(matn: string): string {
  return matn.replace(OG_APOSTROF, '$1ʻ');
}
