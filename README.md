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

`data/kb.json` holds the scraped EPA catalogue (940 products, 95 categories) in
the compact shape described in the build brief. `npm run scrape` regenerates it
from epa.uz in about ten seconds; the buildId is re-read on every run and
refreshed once if a request 404s mid-scrape.

The scrape also runs as a `prebuild` step, so **every deployment ships a fresh
catalogue**. If epa.uz is unreachable the scrape fails loudly in the log and the
build continues with the committed `data/kb.json` — a bad network should not
break a deploy. The same fallback means the committed file is worth keeping
current.

### Daily refresh

`vercel.json` runs a cron at 03:00 UTC against `/api/refresh-kb`.

That route deliberately does **not** scrape. Vercel's filesystem is read-only at
runtime, `/tmp` is per-instance and ephemeral, and `data/kb.json` is a
build-time import that the search index and the landing page's counts are built
from — so writing it at runtime cannot work and would leave instances
disagreeing. Instead the route triggers a redeploy, and the build does the
scraping. One mechanism, one source of truth.

It needs two variables. Vercel sends `CRON_SECRET` as a Bearer token on cron
invocations, and the route rejects anything else — without it the endpoint would
be an open redeploy button.

| Variable | Where it comes from |
|---|---|
| `CRON_SECRET` | any long random string you generate |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel → Settings → Git → Deploy Hooks → create one for `main` |

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

The original build brief (`QUNDUZ_CLAUDE_CODE_BRIEF.md` §12) is complete:

1. ✅ Scaffold, design tokens, landing page with the breathing Qunduz
2. ✅ Scraper → `data/kb.json`
3. ✅ `lib/search.ts` + `/api/chat`
4. ✅ Stage UI, orb, product cards, transcript
5. ✅ `/api/tts` + audio-driven lip sync
6. ✅ Speech input
7. ✅ Cron refresh, deploy

The animation brief (v3 §8) is in progress:

1. ✅ Avatar state machine and idle animations
2. ⬜ Layout transition between the empty and conversation states
3. ✅ Voice integration and apostrophe normalisation
4. ⬜ Amplitude-driven listening and speaking animations
5. ⬜ UI fixes
6. ⬜ Extra poses (optional)
