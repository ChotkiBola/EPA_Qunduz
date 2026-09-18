import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ovozgaTayyorla,
  sonUz,
  narxOvozUchun,
  tilniAniqla,
  apostrof,
} from './normalize';

/* Brief v4 §3.6 — majburiy to'plam. */
const MAJBURIY: [string, string][] = [
  ["1 409 100 so'm", 'taxminan bir million toʻrt yuz ming soʻm'],
  ['750 Вт', 'yetti yuz ellik vatt'],
  ['20 В', 'yigirma volt'],
  ['125 mm', 'bir yuz yigirma besh millimetr'],
  ['EEP-28-3', 'E E P, yigirma sakkiz, uch'],
  ["bolg'a", 'bolgʻa'],
  ['Vaqt', 'Vaqt'],
  ['3 l/min', 'uch litr daqiqada'],
];

test('§3.6 majburiy to‘plam', () => {
  for (const [kirish, kutilgan] of MAJBURIY) {
    assert.equal(ovozgaTayyorla(kirish, 'uz'), kutilgan, `kirish: ${kirish}`);
  }
});

test('sonUz — chegaralar va maxsus hollar', () => {
  assert.equal(sonUz(0), 'nol');
  assert.equal(sonUz(1), 'bir');
  assert.equal(sonUz(10), 'oʻn');
  assert.equal(sonUz(100), 'bir yuz'); // §3.6 jadvali bo'yicha
  assert.equal(sonUz(200), 'ikki yuz');
  assert.equal(sonUz(1000), 'bir ming'); // §3.6 jadvali bo'yicha
  assert.equal(sonUz(2000), 'ikki ming');
  assert.equal(sonUz(1000000), 'bir million'); // millionda "bir" qoladi
  assert.equal(sonUz(1200), 'bir ming ikki yuz');
});

test('bir harfli birlik so‘z ichida ochilmaydi', () => {
  // Bular qisqartma jadvalidagi harflarni o'z ichiga oladi
  for (const soz of ['Vaqt', 'metall', 'gul', 'temir', 'Toshkent']) {
    assert.equal(ovozgaTayyorla(soz, 'uz'), apostrof(soz), `so‘z: ${soz}`);
  }
});

test('uzunroq birlik qisqasidan oldin topiladi', () => {
  assert.equal(ovozgaTayyorla('3 l/min', 'uz'), 'uch litr daqiqada');
  assert.equal(ovozgaTayyorla('5 l', 'uz'), 'besh litr');
  assert.equal(ovozgaTayyorla('7 m3/h', 'uz'), 'yetti kub metr soatda');
});

test('model kodlari — digraf va aralash bo‘laklar', () => {
  assert.equal(ovozgaTayyorla('EMSH-125/1200', 'uz'), 'E M SH, bir yuz yigirma besh, bir ming ikki yuz');
  // SH ajralib "es ha" bo'lib ketmasligi kerak
  assert.ok(ovozgaTayyorla('EMSH-125/1200', 'uz').includes('SH'));
  assert.equal(ovozgaTayyorla('EVF-RO/7', 'uz'), 'E V F, R O, yetti');
});

test('narx — ekranda aniq, ovozda yumaloq', () => {
  assert.equal(narxOvozUchun(1409100, 'uz'), 'taxminan bir million toʻrt yuz ming soʻm');
  assert.equal(narxOvozUchun(496540, 'uz'), 'taxminan besh yuz ming soʻm');
  assert.equal(narxOvozUchun(536800, 'uz'), 'taxminan besh yuz qirq ming soʻm');
  // Ruscha ham "примерно" bilan boshlanadi
  assert.ok(narxOvozUchun(1409100, 'ru').startsWith('примерно'));
});

test('apostrof — barcha variantlar, qo‘shimchaga tegmaydi', () => {
  assert.equal(apostrof("o'zbek"), 'oʻzbek');
  assert.equal(apostrof('to’g’ri'), 'toʻgʻri');
  assert.equal(apostrof('toʼgʼri'), 'toʻgʻri');
  assert.equal(apostrof("EPA'ning"), "EPA'ning"); // o/g emas — tegilmaydi
});

test('til aniqlash — kirill ulushi', () => {
  assert.equal(tilniAniqla('Beton devorni teshish uchun nima kerak?'), 'uz');
  assert.equal(tilniAniqla('Сколько стоит перфоратор?'), 'ru');
  // Aralash: ruscha model nomi o'zbekcha savol ichida — o'zbekcha qolsin
  assert.equal(tilniAniqla('Шлифовальная mashinasi bormi?'), 'uz');
  assert.equal(tilniAniqla('EEP-28-3'), 'uz'); // harf yo'q hisobda — standart
});

test('ruscha normalizatsiya', () => {
  const r = ovozgaTayyorla('750 Вт', 'ru');
  assert.ok(r.includes('ватт'), r);
  assert.ok(/семьсот/i.test(r), r);
});

test('butun javob — real misol', () => {
  const javob =
    "Beton devor uchun EEP-28-3 perforatori to'g'ri keladi. Quvvati 1010 Вт, narxi 1 409 100 so'm.";
  const ovoz = ovozgaTayyorla(javob, 'uz');
  assert.ok(!/\d/.test(ovoz), 'ovozda raqam qolmasligi kerak: ' + ovoz);
  assert.ok(ovoz.includes('E E P'), ovoz);
  assert.ok(ovoz.includes('vatt'), ovoz);
  assert.ok(ovoz.includes('taxminan'), ovoz);
  assert.ok(ovoz.includes('toʻgʻri'), ovoz);
});
