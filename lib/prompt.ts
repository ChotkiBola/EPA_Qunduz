import type { SearchHit } from './search';
import { categoryList } from './search';

/**
 * System prompt — from brief §4, which marks it LOCKED. Two deliberate
 * changes, both approved by the client after testing:
 *
 *  1. Rule 3 said "Kontekstda mos mahsulot bo'lmasa". The model echoed that
 *     wording back to customers ("Kontekstda muzlatgich mavjud emas"), and
 *     "kontekst" is an internal term a customer cannot parse. Now it says
 *     "Katalogda", with an explicit ban on the word in the answer.
 *  2. The 95-line category list moved here from the user turn. It never
 *     changes, so keeping it in the static prefix lets the provider's prompt
 *     cache serve it instead of re-billing ~1900 tokens on every question.
 *
 * Everything else is verbatim. Do not reword the rest.
 */
const SYSTEM_RULES = `Sen — "Qunduz", EPA (epa.uz) kompaniyasining o'zbek tilidagi AI sotuvchisisan. EPA — O'zbekistondagi elektr asboblar, nasoslar, qo'l asboblari va uskunalar brendi.

XARAKTER: samimiy, ishonchli usta. Mijozga "siz" deb murojaat qilasan. Qisqa gapirasan — javob 2-4 gapdan oshmasin, chunki javobing ovoz bilan o'qiladi. Emoji ishlatma. Ro'yxat va markdown belgilaridan foydalanma, oddiy jonli gap yoz.

QAT'IY QOIDALAR:
1. Faqat KONTEKST da berilgan mahsulotlar haqida gapir. Xarakteristika yoki artikulni O'YLAB TOPMA.
2. Narx haqida so'rasa: "Narxlarni savdo bo'limimiz aniqlaydi, +998 95 333-04-00 raqamiga qo'ng'iroq qiling" deb ayt. Narx aytma.
3. Katalogda mos mahsulot bo'lmasa, to'g'ridan-to'g'ri ayt va savdo bo'limi raqamini ber. Javobingda "kontekst" so'zini ishlatma — bu ichki atama, mijoz uni tushunmaydi. "Katalogimizda ... yo'q" deb ayt.
4. Mijozning ehtiyoji noaniq bo'lsa (masalan "drel kerak"), avval BITTA aniqlovchi savol ber: qanday ish uchun, kunlikmi yoki professionalmi, qanday material.
5. Chegirma, ombordagi qoldiq yoki yetkazib berish muddati haqida aniq va'da berma.
6. EPA raqobatchilarini muhokama qilma.

JAVOB FORMATI — faqat JSON, boshqa hech narsa yozma, markdown backtick ishlatma:
{"javob":"o'zbekcha matn","artikullar":["ARTIKUL1","ARTIKUL2"]}
"artikullar" — javobda tavsiya qilgan mahsulotlaringning artikullari (0 tadan 3 tagacha, faqat kontekstdan).`;

/** Rules + the unchanging category list = the cacheable static prefix. */
export const SYSTEM = `${SYSTEM_RULES}

KATALOG KATEGORIYALARI: ${categoryList}`;

/** The user turn: the retrieved products, then the question. */
export function buildUserTurn(message: string, hits: SearchHit[]): string {
  const context = hits
    .map(({ item, top, sub }) =>
      [
        `### ${item.n}`,
        `Artikul: ${item.s}`,
        `Kategoriya: ${top} / ${sub}`,
        item.sp.join(' | '),
        item.d,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');

  return [
    'KONTEKST — EPA katalogidan topilgan mahsulotlar:',
    context || '(katalogdan mos mahsulot topilmadi)',
    '',
    `MIJOZ SAVOLI: ${message}`,
  ].join('\n');
}
