# Build brief — "Qunduz", EPA AI sales assistant (Next.js + Vercel)

You are building a production web app from scratch. A working single-file prototype already validated
every decision below — **the endpoints, field names, coordinates, algorithm and prompt in this brief are
verified, not guesses. Do not redesign them; port them.**

Ask me before deviating from anything marked **LOCKED**.

---

## 0. What this is

EPA (epa.uz) is an Uzbek power-tools, pumps and equipment brand. "Qunduz" (Uzbek for *beaver*) is their
AI sales assistant: an animated beaver mascot in EPA uniform that answers customer questions about the
EPA catalogue in Uzbek, by text or by voice.

**Ship target:** a Vercel-deployed Next.js app. Landing page → click one button → full-screen voice/chat
stage with the animated Qunduz, styled like ChatGPT's voice mode.

---

## 1. Stack

- **Next.js 14+, App Router, TypeScript**
- **Tailwind CSS**
- Deploy: **Vercel**
- No database. Knowledge base is a generated JSON file committed to the repo.
- Server-side API routes hold all secrets. **No API key ever reaches the browser.**

Environment variables (add to `.env.local` and Vercel project settings):

```
ANTHROPIC_API_KEY=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=      # e.g. westeurope
```

Include `.env.example`. Never commit real keys.

---

## 2. Knowledge base pipeline — `scripts/scrape-epa.ts`

epa.uz is a Next.js site. Its catalogue data is reachable through the `_next/data` JSON endpoints.
**All of the following is verified working.**

### 2.1 Get the buildId (LOCKED — it rotates on every epa.uz redeploy)

```
GET https://epa.uz/
→ regex the HTML for  "buildId":"([^"]+)"
```
The scraper must re-read this on every run. Never hardcode it. If a request 404s mid-run, refresh the
buildId once and retry.

### 2.2 Top-level categories (LOCKED — Uzbek slugs)

```
elektr-asboblar
water-pumps
uskunalar
qol-asboblar
aksessuar-va-sarf-materiallar
```
Note `water-pumps` is genuinely an English slug in the `uz` locale. Slugs differ per locale; use the
`uz` ones above.

### 2.3 Subcategories

```
GET https://epa.uz/_next/data/{buildId}/uz/catalog/{topSlug}.json
→ pageProps.data.children[]  →  { name, slug.uz, products_count }
```
Yields **95 subcategories**.

### 2.4 Product listing (paginated)

```
GET https://epa.uz/_next/data/{buildId}/uz/catalog/{topSlug}/{subSlug}.json?page=N
→ pageProps.pageList.data[]      // products
→ pageProps.pageList.meta.last_page
```
Loop pages until `last_page`. Yields **940 products** total. Run subcategories in parallel
(~16 concurrent is fine, the whole scrape takes ~10s). Dedupe by product `id`.

`encodeURIComponent()` every slug segment.

### 2.5 Product fields (LOCKED)

| Field | Meaning |
|---|---|
| `title` | Uzbek product name — **use this** |
| `name` | Russian product name |
| `sku` | artikul, e.g. `EEP-28-3` |
| `specifications[]` | `{ name, unit, options: [{ name }] }` → render as `"Quvvat sarfi: 1010 Vt"` |
| `description` | real description, **HTML** — strip tags |
| `content` | junk placeholder — **ignore it** |
| `package_content` | box contents, newline-separated |
| `images[0].sizes.small` | thumbnail URL (`https://images.epa.uz/storage/images/...`) |
| `slug` | product page → `https://epa.uz/uz/product/{slug}` |
| `status` | `filled`/`not-filled` = *card completeness*, NOT on/off-site. Ignore. |

> **There is no price field anywhere in this API.** Prices are not on epa.uz. Qunduz must never state a
> price. See the system prompt rule 2.

### 2.6 Output

Write `data/kb.json`:

```jsonc
{
  "cats": [["Elektr asboblar","Perforatorlar"], ...],   // index → [top, sub]
  "items": [{
    "n": "Perforator EEP-28-3 (1010Vt)",   // title
    "s": "EEP-28-3",                        // sku
    "c": 8,                                 // index into cats
    "sp": ["Kuchlanish: 220 V", "Quvvat sarfi: 1010 Vt", "..."],  // max 7
    "d": "first sentence of description, ≤150 chars",
    "u": "perforator-eep-28-3-1010vt",      // slug
    "i": "3/775/13999.jpg"                  // image path after the storage prefix
  }]
}
```
This shape keeps the file ~310 KB. A working snapshot ships alongside this brief as
`kb-snapshot.json` — use it to develop against before the scraper is finished.

Add `npm run scrape`, and a Vercel Cron (`vercel.json`) hitting `/api/refresh-kb` once daily that
re-runs the scrape and writes the file. Guard that route with a `CRON_SECRET`.

---

## 3. Retrieval — `lib/search.ts` (LOCKED algorithm, it is tested)

Plain keyword scoring. No embeddings in v1 — this already returns the right products.

```ts
const STOP = new Set(['va','uchun','bilan','qanday','qaysi','nima','menga','kerak','bor','iltimos',
  'eng','yaxshi','ayting','bering','tavsiya','qiling','men','siz','shu','bu',
  'the','and','for','with','what','which','how']);

const norm = (s:string) => s.toLowerCase()
  .replace(/[’ʻʼ`]/g, "'")
  .replace(/[^a-z0-9а-яё'\s\-]/gi, ' ');

const toks = (s:string) => norm(s).split(/[\s\-]+/).filter(w => w.length > 2 && !STOP.has(w));
```

Index blob per product = `norm([n, s, sub, top, sp.join(' '), d].join(' '))`.

Scoring per query token:
- token appears in the **sku** → **+12**
- token appears in blob preceded by a space → **+3** if token length > 4, else **+2**
- else token appears anywhere in blob → **+1**

Sort desc, take **top 7**. Also fold in the last ~4 messages of conversation text so follow-ups
("va undan kuchliroq bormi?") still retrieve.

Verified results: *"beton devorni teshish"* → perforators/perfodrels; *"quduqdan suv chiqarish"* →
chuqurlik nasoslari; *"metall kesish"* → EMSH grinders + abrasive discs; *"EEP-28-3"* → exact match first.

---

## 4. `POST /api/chat`

Request: `{ message: string, history: {role,content}[] }`
Response: `{ javob: string, artikullar: string[] }`

Server steps:
1. `search(message, recentHistoryText)` → top 7 products
2. Build the user turn:

```
KONTEKST — EPA katalogidan topilgan mahsulotlar:
### {n}
Artikul: {s}
Kategoriya: {top} / {sub}
{sp joined with " | "}
{d}
... (×7)

KATALOG KATEGORIYALARI: {all 95 "top / sub" joined with "; "}

MIJOZ SAVOLI: {message}
```

3. Call the Anthropic Messages API — `model: "claude-sonnet-4-6"`, `max_tokens: 1000`, last 8 messages.
   Use the official `@anthropic-ai/sdk`.
4. Parse the JSON out of the reply. **If JSON parsing fails, return the raw text as `javob`** rather
   than an empty string — a silent empty answer was a real bug in the prototype.
5. On any upstream error, return the actual error message with a non-200 status so the UI can show it.
   Never swallow errors.

### System prompt (LOCKED — copy verbatim, it is tuned)

```
Sen — "Qunduz", EPA (epa.uz) kompaniyasining o'zbek tilidagi AI sotuvchisisan. EPA — O'zbekistondagi elektr asboblar, nasoslar, qo'l asboblari va uskunalar brendi.

XARAKTER: samimiy, ishonchli usta. Mijozga "siz" deb murojaat qilasan. Qisqa gapirasan — javob 2-4 gapdan oshmasin, chunki javobing ovoz bilan o'qiladi. Emoji ishlatma. Ro'yxat va markdown belgilaridan foydalanma, oddiy jonli gap yoz.

QAT'IY QOIDALAR:
1. Faqat KONTEKST da berilgan mahsulotlar haqida gapir. Xarakteristika yoki artikulni O'YLAB TOPMA.
2. Narx haqida so'rasa: "Narxlarni savdo bo'limimiz aniqlaydi, +998 95 333-04-00 raqamiga qo'ng'iroq qiling" deb ayt. Narx aytma.
3. Kontekstda mos mahsulot bo'lmasa, to'g'ridan-to'g'ri ayt va savdo bo'limi raqamini ber.
4. Mijozning ehtiyoji noaniq bo'lsa (masalan "drel kerak"), avval BITTA aniqlovchi savol ber: qanday ish uchun, kunlikmi yoki professionalmi, qanday material.
5. Chegirma, ombordagi qoldiq yoki yetkazib berish muddati haqida aniq va'da berma.
6. EPA raqobatchilarini muhokama qilma.

JAVOB FORMATI — faqat JSON, boshqa hech narsa yozma, markdown backtick ishlatma:
{"javob":"o'zbekcha matn","artikullar":["ARTIKUL1","ARTIKUL2"]}
"artikullar" — javobda tavsiya qilgan mahsulotlaringning artikullari (0 tadan 3 tagacha, faqat kontekstdan).
```

---

## 5. `POST /api/tts` — real Uzbek voice

This is the whole reason for a backend. Browsers have **no Uzbek TTS voice**; the prototype had to fake
it with a Russian or Turkish voice and it sounded wrong. Azure has genuine Uzbek neural voices.

- Voice: **`uz-UZ-SardorNeural`** (male). Female alternative: `uz-UZ-MadinaNeural`.
- Send the Uzbek Latin text **as-is** — no transliteration, that hack is no longer needed.
- Azure Speech REST: POST to `https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`
  with headers `Ocp-Apim-Subscription-Key`, `Content-Type: application/ssml+xml`,
  `X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3`, and an SSML body selecting the voice.
  **Verify the exact contract against current Azure Speech docs before writing the code.**
- Return `audio/mpeg`. Cache by hash of (text + voice) — the greeting and common answers repeat, and
  Azure bills per character.
- Fallback chain if Azure fails or keys are missing: browser `speechSynthesis`. In that case reuse the
  transliteration helpers in §8 so the fallback is at least intelligible.

---

## 6. Speech input

Client-side `webkitSpeechRecognition`, `lang = 'uz-UZ'`, `interimResults: true`, `continuous: false`.
Show interim text live in the input; on `onend`, submit automatically if non-empty.

Chrome only. If `SpeechRecognition` is undefined, disable the mic button with a tooltip. Requires a
secure context — works on the Vercel HTTPS domain, does **not** work from a `file://` page.

---

## 7. The Qunduz avatar

Two pre-cut PNG layers ship with this brief. Put them in `public/`:

- `qunduz-body.png` — body, head, cap, arms. Background removed, tail cut out.
- `qunduz-tail.png` — the tail alone, meant to render **behind** the body.

Both are **558 × 617** and share the same origin, so draw both at `(0,0,558,617)` and they line up exactly.

### 7.1 SVG rig (LOCKED coordinates — measured from the artwork)

`viewBox="0 0 558 617"`, z-order bottom→top: tail image → body image → mouth → tongue → eyelids.

| Part | Geometry |
|---|---|
| Left eyelid | ellipse, cx **186.5**, cy **198.0**, r **23.8** |
| Right eyelid | ellipse, cx **325.4**, cy **198.0**, r **23.8** |
| Eyelid fill | `#B66536` (the fur colour around the eyes) |
| Mouth | ellipse, cx **255.6**, top edge fixed at y **325.4** |
| Mouth fill | `#41180F`; tongue `#C0564F` |
| Tail rotation pivot | **(413.3, 507.6)** |
| Whole-body scale pivot (feet) | **(278.6, 609.8)** |

Animation rules:
- **Blink** — scale the eyelid ellipses vertically 0→1→0 over ~150 ms, every 2.4–6.6 s at random.
  Implement by setting `ry` *and* shifting `cy` so the lid closes downward from the top of the eye.
- **Breathe** — `scale(1, 1 + sin(t*1.55)*0.014)` about the feet pivot, plus ~1 px horizontal sway.
- **Tail** — rotate `sin(t*1.9)*2.2°` about the pivot, add `sin(t*8)*1.6°` while speaking.
- **Lip sync** — mouth `ry = open*27`, `rx = 30 + open*13`, `cy = 325.4 + ry` (so the top edge stays
  pinned under the teeth). Tongue at `ry*0.3` / `rx*0.45`, `cy = 325.4 + ry*1.55`.
  - Teeth belong to the upper jaw and **must not move** — that is anatomically correct for a beaver
    and it looks right.
  - **Drive `open` from real audio**: pipe the `/api/tts` audio element through a Web Audio
    `AnalyserNode`, take the smoothed RMS, normalise to 0–1. Only fall back to a synthetic
    `sin` oscillator when using browser `speechSynthesis`, which exposes no audio level.
- Respect `prefers-reduced-motion: reduce` — freeze everything.

Use `requestAnimationFrame`, one loop, and drive the **same rig on both the landing hero and the
stage** from it.

---

## 8. Fallback transliteration — `lib/translit.ts`

Only used when Azure is unavailable and we fall back to browser TTS. Keep it; it took real tuning.

```ts
const isCode = (t: string) => /\d/.test(t) || t.replace(/[^A-Z]/g,'').length >= 2;
```
Tokens matching `isCode` are product artikuls (`EEP-28-3`, `EMSH-125P`, `PRO`) and must be **excluded**
from letter substitution, otherwise "EMSH" becomes "EMŞ" and "PRO" becomes "PRA".

**Uzbek → Turkish** (closest phonetics for browser TTS): `o'`→`o`, `g'`→`ğ`, `sh`→`ş`, `ch`→`ç`,
`x`→`h`, `q`→`k`, `w`→`v`, then `o`→`a`. Replace `o'` with a sentinel **first** and restore it last,
otherwise the later `o`→`a` rule eats it and `to'g'ri` becomes `tağri` instead of `toğri`.

**Uzbek → Cyrillic** (for Russian voices): same sentinel technique. `o'`→`о`, `g'`→`г`, `sh`→`ш`,
`ch`→`ч`, `yo`→`ё`, `yu`→`ю`, `ya`→`я`, then single letters with `o`→`а`, `q`→`к`, `x`→`х`, `y`→`й`,
`c`→`к`, `j`→`ж`. Code tokens get a separate uppercase map where `o`→`О` (not `А`).

**Uzbek → English** rules: `o'`→`o`, `g'`→`g`, `x`→`h`, `q`→`k`, `i`→`ee`, `u`→`oo`.

Pick the map from the selected voice's `lang` prefix (`uz` → none, `tr`/`az` → Turkish,
`ru`/`uk`/`kk`/`be` → Cyrillic, anything else → English).

---

## 9. UI

### 9.1 Design tokens (LOCKED)

```
--tub        #0E2A2F   page background (deep river teal)
--tub2       #143A40   panels
--tub3       #1C4B52   raised
--yogoch     #C98A4B   timber accent
--yogoch-och #E5BC8A   light timber (headings, sku labels)
--suv        #8FCBBF   water mint (status, secondary)
--epa        #E22929   EPA brand red — this is their real brand colour, use it for the CTA only
--qor        #F5EFE3   text
--xira       #9DB3B1   muted text
```

Fonts (Google Fonts): **Bricolage Grotesque** 700/800 for display, **Manrope** for body,
**JetBrains Mono** 500 for artikul/spec chips.

The palette comes from the mascot's world — river, timber, water — with EPA red as the single brand
accent. Do not swap it for a generic dark-mode-plus-neon or cream-and-serif look.

### 9.2 Landing page

Two-column hero: left = eyebrow `epa.uz uchun prototip`, H1 **Qunduz** with `savolga javob beradi`
on a second line in `--yogoch-och`, a short lede, and the CTA button **"Qunduz bilan gaplashish"**
(red pill, pulsing dot). Right = the Qunduz artwork, breathing and blinking.

Below: a row of timber "log" bars as a divider, then three stat cards — product count, category count,
and "O'zbekcha". Footer carries the sales line **+998 95 333-04-00**.

### 9.3 Stage (the main screen)

Full-screen, radial gradient from `#1B4A52` at top to `#08191C` at the bottom.

- **Top bar**: EPA badge, "Qunduz", then icon buttons — mute, transcript, settings, close.
- **Orb**: Qunduz large and centred, with three concentric rings and a soft radial glow behind.
  Rings scale with mouth openness while speaking; they turn EPA-red and pulse while the mic is live.
- **Status line** under the orb: `o'ylayapti` / `eshityapti` / `gapiryapti`.
- **Answer area**: the user's question small in `--yogoch-och` above, the answer large and centred below.
- **Product cards**: thumbnail + Uzbek title + mono artikul, linking to
  `https://epa.uz/uz/product/{slug}` in a new tab.
- **Starter chips**, shown only before the first question:
  `Beton devorni teshish uchun nima kerak?` · `Quduqdan suv chiqaradigan nasos` ·
  `Metall kesish uchun bolgarka` · `EEP-28-3 haqida ayting`
- **Bottom bar**: text input (`Savolingizni yozing…`), mic button, send button.
- **Settings sheet**: voice picker, speed, mute.
- **Transcript sheet**: full conversation history.

Opening greeting (spoken and shown):
`Assalomu alaykum! Men Qunduzman, EPA ning sotuvchisiman. Qanday ish uchun asbob kerak, aytavering.`

Errors are visible, never silent: show the message plus a **"Qayta urinish"** button, and drop the
failed turn from the conversation history so it doesn't poison later context.

Must work down to a 380 px viewport, keyboard focus must be visible, `Esc` closes the stage.

---

## 10. Pitfalls that already bit us — do not repeat

1. **Never give a DOM element an `id` that collides with a `window` built-in** — `open`, `close`,
   `name`, `status`, `history`, `top`, `length`, `self`, `parent`, `find`, `location`, `origin`.
   `id="open"` silently attached the click handler to `window.open` and the button did nothing.
   (Less of a risk in React, but the rule stands for any `document.getElementById` usage.)
2. **`speechSynthesis.getVoices()` returns a partial list on first call.** Re-select the preferred voice
   on `onvoiceschanged` and on retries at ~250/900/2200 ms — but never override a voice the user
   picked manually.
3. **epa.uz `buildId` rotates.** Re-read it every scrape run.
4. **`api.epa.uz` is a different host and was unreachable from our sandbox** — everything needed is on
   `epa.uz` itself.
5. **No prices exist in the API.** Any price in an answer is a hallucination.
6. **Don't trust `status: filled`** as an on-sale flag; disabled products simply never appear in listings.
7. The prototype ran from `file://` at one point and every API call failed on CORS. On Vercel this is
   moot, but keep all model/TTS calls server-side regardless.

---

## 11. Deliverables

1. Working Next.js app, `npm run dev` clean, no console errors.
2. `npm run scrape` regenerating `data/kb.json`, plus the daily cron route.
3. `README.md`: env vars, how to scrape, how to deploy, how to swap the TTS voice.
4. Deployed to Vercel with env vars set; give me the preview URL.
5. `.env.example`, no secrets committed.

### Acceptance checks

- [ ] "Beton devorni teshish uchun nima kerak?" → answer names a real perforator artikul, card links resolve
- [ ] "Narxi qancha?" → refuses and gives +998 95 333-04-00
- [ ] "Drel kerak" → asks one clarifying question instead of dumping a list
- [ ] Asking about something EPA doesn't sell → says so plainly, invents nothing
- [ ] Mic → speech → auto-submit → spoken Uzbek answer, mouth moves in time with the audio
- [ ] Kill the Anthropic key → visible error + working "Qayta urinish", no blank screen
- [ ] 380 px viewport usable; `prefers-reduced-motion` freezes the animation

---

## 12. Build order

1. Scaffold + tokens + landing page with the static (breathing) Qunduz
2. Scraper → `data/kb.json`
3. `lib/search.ts` + `/api/chat` — text chat working end to end
4. Stage UI, orb, product cards, transcript
5. `/api/tts` + audio-driven lip sync
6. Speech input
7. Cron refresh, README, deploy
