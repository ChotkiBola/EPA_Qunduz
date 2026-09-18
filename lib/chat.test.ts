import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qismanJavob, parseReply, sanitiseHistory } from './chat';

/* Oqim paytida model strict JSON yozadi, lekin u bo'lak-bo'lak keladi.
   qismanJavob yarim JSON dan "javob" maydonining hozirgacha kelgan qismini
   ajratadi — shu tufayli mijoz model yozayotgan paytda o'qiy boshlaydi. */
test('qismanJavob — oqim bosqichma-bosqich', () => {
  const bosqichlar: [string, string][] = [
    ['{', ''],
    ['{"jav', ''],
    ['{"javob":"', ''],
    ['{"javob":"Beton', 'Beton'],
    ['{"javob":"Beton devor uchun', 'Beton devor uchun'],
    ['{"javob":"Beton devor uchun perforator kerak.","artikullar":[', 'Beton devor uchun perforator kerak.'],
    ['{"javob":"Tugadi.","artikullar":["EEP-28-3"]}', 'Tugadi.'],
  ];
  for (const [xom, kutilgan] of bosqichlar) {
    assert.equal(qismanJavob(xom), kutilgan, `xom: ${xom}`);
  }
});

test('qismanJavob — qochirilgan belgilar oqim ichida buzilmaydi', () => {
  /* Oxirida yarim qochirish ketma-ketligi (yolg'iz \) kelsa, tayyor qism
     ko'rsatiladi va osilgan belgi tashlanadi — hech narsa ko'rsatmaslikdan
     yaxshiroq, chunki keyingi bo'lak baribir 50ms dan keyin keladi. */
  assert.equal(qismanJavob('{"javob":"Narx 1 409 100 so\\'), 'Narx 1 409 100 so');
  assert.equal(qismanJavob('{"javob":"Qator\\nikkinchi'), 'Qator\nikkinchi');
  assert.equal(qismanJavob('{"javob":"U \\"EEP\\" dedi'), 'U "EEP" dedi');
});

test('parseReply — to‘liq JSON, markdown va buzuq matn', () => {
  assert.deepEqual(parseReply('{"javob":"Salom","artikullar":["A1"]}'), {
    javob: 'Salom',
    artikullar: ['A1'],
  });
  // Ba'zan model backtick bilan o'rab yuboradi
  assert.equal(parseReply('```json\n{"javob":"Salom","artikullar":[]}\n```').javob, 'Salom');
  // Umuman JSON bo'lmasa — xom matn yo'qolmasin, bo'sh javob eng yomoni
  assert.equal(parseReply('Shunchaki matn').javob, 'Shunchaki matn');
});

test('sanitiseHistory — suhbat user navbatidan boshlanadi', () => {
  // Sahna avval salomlashadi; API esa user dan boshlanishini talab qiladi
  const tarix = sanitiseHistory([
    { role: 'assistant', content: 'Assalomu alaykum!' },
    { role: 'user', content: 'Drel kerak' },
    { role: 'assistant', content: 'Qanday ish uchun?' },
  ]);
  assert.equal(tarix[0].role, 'user');
  assert.equal(tarix.length, 2);

  // Faqat salomlashish bo'lsa — yuboradigan tarix yo'q
  assert.deepEqual(sanitiseHistory([{ role: 'assistant', content: 'Salom' }]), []);
  assert.deepEqual(sanitiseHistory('array emas'), []);
  // Bo'sh xabarlar tushib qoladi
  assert.deepEqual(sanitiseHistory([{ role: 'user', content: '   ' }]), []);
});
