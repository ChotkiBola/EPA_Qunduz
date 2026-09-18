# Qunduz — EPA AI sotuvchi

Uzbek-language AI sales assistant for [epa.uz](https://epa.uz): an animated beaver
mascot that answers catalogue questions by text or voice.

Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel. All secrets stay
server-side — no key ever reaches the browser.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your key
npm run dev
```

| Variable | Used by |
|---|---|
| `OPENAI_API_KEY` | `/api/chat` — the voice needs no key |
| `OPENAI_MODEL` | optional; defaults to `gpt-5.6-terra` |
| `CRON_SECRET` | `/api/refresh-kb` (daily cron) |
| `VERCEL_DEPLOY_HOOK_URL` | `/api/refresh-kb` (daily cron) |

The chat model is swappable without a code change: `gpt-5.6-sol` is the
strongest, `gpt-5.6-terra` the balance, `gpt-5.6-luna` the fastest and cheapest.
The answer is read aloud, so latency is part of the trade-off.

`.env.local` is git-ignored and holds the real key. `.env.example` is the
tracked template — its values stay empty.

## Voice

Text-to-speech runs through `GET /api/tts?text=…` on **`uz-UZ-SardorNeural`**, a
genuine Uzbek neural voice, reached through the keyless Edge Read Aloud service
via `msedge-tts`. Voice, rate and pitch live in `lib/ovoz.ts` — one file, so they
can be re-tuned by ear without hunting through the code.

**Apostrophes are normalised before synthesis, and this is not optional.** The
voice only pronounces `oʻ` and `gʻ` correctly with the official U+02BB
character; a plain `'` mangles them, and the 940-product catalogue spells its
apostrophes at least four different ways. `ovozUchunTayyorla()` rewrites them,
and only after `o` and `g`, so a suffix like `EPA'ning` is left alone. Screen
text is never touched — only the copy sent to the voice.

Two operational notes, both found by breaking it:

- `msedge-tts` pulls in `ws`, which conditionally requires optional native
  addons. Webpack bundling breaks that with `bufferUtil.mask is not a function`,
  turning every request into a 12-second timeout. Both packages are listed in
  `serverExternalPackages` in `next.config.mjs` so Node loads them normally.
  **Do not remove that line.**
- Synthesis is wrapped in a 12s deadline that covers `setMetadata` as well as
  the stream. A 91-second stall was observed in testing, and `setMetadata` is
  where the socket opens — a stream-only guard did not catch it and the request
  hung instead.

Audio is cached twice: an in-process map keyed by
`sha256(voice|rate|pitch|text)`, so a warm instance never re-synthesises the
greeting, and `Cache-Control: immutable` so the browser and Vercel's CDN hold it
too. Measured locally: 2.1 s on a miss, 23 ms on a hit.

The mouth is driven by the real waveform — an `AnalyserNode` over the playing
element, smoothed RMS, normalised to 0–1 and written into a ref that both the
rig and the orb rings read.

A browser will not play audio the user did not ask for, so the spoken greeting
is best-effort: if autoplay is blocked it stays on screen silently, and the
first answer speaks normally because a click preceded it.

> **Risk worth knowing.** Edge Read Aloud is not a documented public API. It is
> free and needs no key, which is why the animation brief chose it, but it
> carries no SLA and can change without notice. Azure Speech serves the same
> `uz-UZ-SardorNeural` voice under a supported contract if that ever matters —
> the swap would be confined to `app/api/tts/route.ts`.

## Microphone

Speech input uses the browser's own `SpeechRecognition` at `lang = "uz-UZ"`,
with interim results shown live in the input and automatic submission when the
utterance ends. Starting the mic stops Qunduz mid-sentence, so a customer can
talk over him.

It needs Chrome and a secure context. The button disables itself with an
explanatory tooltip anywhere else — including plain `http://` on a LAN address,
which is why testing on a phone means using the Vercel URL rather than
`http://192.168.x.x:3000`. `localhost` counts as secure.

Recognition quality for Uzbek is Chrome's, not ours. If `uz-UZ` turns out to be
weak on a real device, the fallback is to keep typing as the primary input; the
rest of the stage does not depend on the mic.

## Avatar

The idle loops — breathing, tail sway, ring fade — are CSS animations, not a JS
loop. CSS runs on the compositor, so the beaver keeps moving when the main
thread is busy and keeps its timeline when `requestAnimationFrame` is throttled.
JS owns only what is data-driven: the blink schedule and the mouth.

Durations come from the animation brief and are deliberately non-divisible
(4.2 s breathing against 6.8 s tail) so the two never sync up and read as
mechanical.

State drives everything through one `data-holat` attribute and one `--level`
custom property, written by a single rAF pump. In `thinking` the rings become an
arc rather than a full circle — rotating a perfect circle is invisible.

**Known limitation:** `qunduz-body.png` is a single layer containing the head,
cap and arms, so there is no head to tilt on its own. The listening and thinking
states lean the whole figure from the feet instead. A separate head layer would
be the real fix.

## Knowledge base

`data/kb.json` holds the catalogue from **epamarket.uz**, which is the whole
point of the v4 migration: unlike epa.uz it carries a price and a stock count,
so Qunduz can answer with a number instead of deflecting to the sales line on
every question.

The data comes from a public REST API, not scraping. `api2.epamarket.uz`
exposes it and needs no key — the brief's fallback of asking the EPA backend
team turned out to be unnecessary:

| Endpoint | Gives |
|---|---|
| `GET /api/v1/products?page=N` | 62 pages of 15, honours `Accept-Language` |
| `GET /api/v1/products/{slug}` | `epamarket_price`, `epamarket_stock`, specs, per-locale slugs |
| `GET /api/v1/categories` | categories |

Two things that are not obvious and cost time to find:

- **Price and stock live only on the detail endpoint.** The list has neither, so
  a full catalogue means one detail call per product rather than 62 list calls.
- **Uzbek content needs the Uzbek slug, not just the header.** `Accept-Language:
  uz` against a Russian slug returns 404, because the slugs differ per locale.
  The detail response carries a `slug` object with all four locales; that is
  where the Uzbek one comes from.

`npm run scrape` rebuilds the file. Concurrency is 3, measured: the API returned
429 and dropped 93% of the catalogue at 16, while 3 sustains about 8 requests a
second cleanly. The run takes a while — roughly 1900 calls — and prints progress
every 100 products so a quiet process is not mistaken for a hung one.

The old epa.uz scraper is still there as `npm run scrape:epa`.

`prebuild` runs the scrape before every `next build`, which is how a deploy
ships fresh data. A full run is about half an hour, though, so it skips when
`data/kb.json` is younger than 12 hours — otherwise every code deploy would pay
for a scrape it does not need, and would sit close to Vercel's build timeout.
The daily cron arrives 24 hours apart, so it always passes the check. Override
with `SCRAPE_MAX_AGE_HOURS`, or force a run with `npm run scrape -- --force`.

### Guards

Per the brief, the writer refuses bad data rather than shipping it:

- If the catalogue shrank by more than 20% against the previous file, it throws
  and writes nothing. This already fired for real during development, when rate
  limiting cost most of the catalogue.
- The previous file is kept as `data/kb.oldingi.json`, one version back.
- Every file carries `updated_at`. If it is older than 7 days the system prompt
  gains an instruction to add a short "the price may have changed" caveat, since
  stating a stale price confidently is the worst outcome.

### Daily refresh

`vercel.json` runs a cron at 03:00 UTC against `/api/refresh-kb`.

That route deliberately does **not** scrape. Vercel's filesystem is read-only at
runtime, `/tmp` is per-instance and ephemeral, and `data/kb.json` is a
build-time import that the search index is built from — so writing it at runtime
cannot work and would leave instances disagreeing. Instead the route triggers a
redeploy, and the build does the scraping. One mechanism, one source of truth.

It needs two variables. Vercel sends `CRON_SECRET` as a Bearer token on cron
invocations, and the route rejects anything else — without it the endpoint would
be an open redeploy button.

| Variable | Where it comes from |
|---|---|
| `CRON_SECRET` | any long random string you generate |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel → Settings → Git → Deploy Hooks → create one for `main` |

## Two front ends

Both use the same brain and the same catalogue; they differ in what they are for.

| | `/stage` | `/chat` |
|---|---|---|
| Avatar | large, animated | none |
| Voice | in and out | none — the voice code is never imported |
| Answers | complete, then spoken | streamed token by token |
| For | demo, the "wow" | a fast assistant |

`/chat` streams for real rather than typing out a finished answer. The model
returns strict JSON, so the stream carries partial JSON; the route extracts the
`javob` field as it arrives and forwards just the new characters over SSE. The
schema guarantee is kept and the customer starts reading while the model is
still writing.

`/chat` is built to stand alone so it can later be embedded in epamarket.uz as a
widget, and it holds no state outside itself.

## Language

Uzbek and Russian. The answer is always in the language of the question —
answering an Uzbek question in Russian is an outright bug.

Language is decided in this order: the UZ/RU switch in the header (stored in
`localStorage`), then the script of the question, then Uzbek.

The brief proposed "more than 30% Cyrillic means Russian". That rule fails a
real case its own acceptance criteria require: *"Шлифовальная mashinasi
bormi?"* is an Uzbek question using a Russian product name, comes out at 46%
Cyrillic, and would be answered in Russian. Majority script is used instead —
that question stays Uzbek, while *"Сколько стоит EEP-28-3?"* at 80% is Russian.

Each language has its own voice, because `uz-UZ-SardorNeural` cannot speak
Russian: Uzbek uses Sardor, Russian uses `ru-RU-DmitryNeural`. They do not sound
like the same person, which is fine — a customer uses one language per session.

## Deploying

1. Push to GitHub and import the repo in Vercel (framework auto-detects as
   Next.js; no build-command override needed).
2. Add the environment variables under **Settings → Environment Variables**,
   ticking Production, Preview and Development:
   - `OPENAI_API_KEY` — required; without it `/api/chat` returns a visible 500.
     The voice does not use it.
   - `OPENAI_MODEL` — optional.
   - `CRON_SECRET` and `VERCEL_DEPLOY_HOOK_URL` — only needed for the daily
     refresh. Create the deploy hook first, then paste its URL here.
3. Redeploy. Vercel does not retrofit new variables onto an existing deployment,
   so a deploy that predates the variables keeps failing until you trigger a
   fresh one.

To check the cron by hand:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/refresh-kb
```

A correct secret returns `{"ok":true,"triggered":true}` and starts a deployment;
anything else returns 401.

## Development notes

Stop the dev server before `npm run build`. Both write to the same `.next`
directory, and a concurrent build leaves the dev server throwing
`Cannot find module './xxx.js'` until the directory is deleted.

## Build order

The original build brief (`QUNDUZ_CLAUDE_CODE_BRIEF.md` §12) is complete.

Animation brief (v3 §8):

1. ✅ Avatar state machine and idle animations
2. ✅ Layout transition between the empty and conversation states
3. ✅ Voice integration and apostrophe normalisation
4. ✅ Amplitude-driven listening and speaking animations
5. ✅ UI fixes
6. ⬜ Extra poses — optional, needs new artwork

Data brief (v4 §6):

1. ✅ Normalisation module and tests
2. ✅ Russian voice and language routing
3. ✅ epamarket API discovery
4. ✅ Catalogue migration with prices
5. ✅ Daily refresh
6. ✅ `/chat` route

### Where the briefs contradicted themselves

Both resolved in favour of the acceptance criteria, since that is what the
work is judged on. Recorded here so the decisions are not mistaken for drift.

- **v4 §3.3 vs §3.6.** The sample code renders 125 as "yuz yigirma besh"; the
  mandatory test table expects "bir yuz yigirma besh". The table wins, and it
  is the standard spoken form.
- **v4 §2.2 vs §7.** "More than 30% Cyrillic means Russian" would answer
  *"Шлифовальная mashinasi bormi?"* — an Uzbek question with a Russian product
  name, 46% Cyrillic — in Russian, which §7 forbids. Majority script is used
  instead.
- **v3 §2.2/§2.3 vs the artwork.** The brief asks the head to tilt on its own,
  but `qunduz-body.png` is one layer with head, cap and arms in it. The whole
  figure leans from the feet instead.
- **v3 §3.3 asks for FLIP.** Not used: the avatar stays in flow and only its
  width changes, so FLIP would add machinery without changing the result.
  Staged CSS transitions with the brief's timings and easing do the job.
