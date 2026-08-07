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
| `OPENAI_API_KEY` | `/api/chat` and `/api/tts` |
| `OPENAI_MODEL` | optional; defaults to `gpt-5.6-terra` |
| `CRON_SECRET` | `/api/refresh-kb` (daily cron) |
| `VERCEL_DEPLOY_HOOK_URL` | `/api/refresh-kb` (daily cron) |

One provider, one key. The chat model is swappable without a code change:
`gpt-5.6-sol` is the strongest, `gpt-5.6-terra` the balance, `gpt-5.6-luna` the
fastest and cheapest. The answer is read aloud, so latency is part of the
trade-off.

`.env.local` is git-ignored and holds the real key. `.env.example` is the
tracked template — its values stay empty.

> **Note on the build brief.** §5 specifies Azure Speech (`uz-UZ-SardorNeural`)
> for text-to-speech, because browsers ship no Uzbek voice. We compared that
> plan against OpenAI TTS by generating real Uzbek samples and listening to
> them; the client picked **`gpt-4o-mini-tts`, voice `ash`, no style
> instructions**. That keeps the stack on a single provider and removes the
> Azure account entirely. It also makes the §8 transliteration helpers
> unnecessary — those existed only for the browser `speechSynthesis` fallback.

## Voice

Text-to-speech runs through `GET /api/tts?text=…` on `gpt-4o-mini-tts` with the
`ash` voice. To change the voice, edit that route — the eleven built-in voices
are listed in the OpenAI text-to-speech guide.

Audio is cached twice: an in-process map keyed by `sha256(model|voice|text)`,
so a warm instance never re-bills the greeting, and `Cache-Control: immutable`
so the browser and Vercel's CDN hold it too. Measured locally: 3.6 s on a miss,
31 ms on a hit.

The mouth is driven by the real waveform — an `AnalyserNode` over the playing
element, smoothed RMS, normalised to 0–1 and written into a ref that both the
rig and the orb rings read. There is no synthetic oscillator because there is
no browser-speech fallback to need one.

A browser will not play audio the user did not ask for, so the spoken greeting
is best-effort: if autoplay is blocked it stays on screen silently, and the
first answer speaks normally because a click preceded it.

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
invocations, and the route rejects anything else — without it the endpoint
would be an open redeploy button.

| Variable | Where it comes from |
|---|---|
| `CRON_SECRET` | any long random string you generate |
| `VERCEL_DEPLOY_HOOK_URL` | Vercel → Settings → Git → Deploy Hooks → create one for `main` |

## Deploying

1. Push to GitHub and import the repo in Vercel (framework auto-detects as
   Next.js; no build-command override needed).
2. Add the environment variables under **Settings → Environment Variables**,
   ticking Production, Preview and Development:
   - `OPENAI_API_KEY` — required; without it both `/api/chat` and `/api/tts`
     return a visible 500.
   - `OPENAI_MODEL` — optional.
   - `CRON_SECRET` and `VERCEL_DEPLOY_HOOK_URL` — only needed for the daily
     refresh. Create the deploy hook first, then paste its URL here.
3. Redeploy. Vercel does not retrofit new variables onto an existing
   deployment, so a deploy that predates the variables keeps failing until you
   trigger a fresh one.

To check the cron by hand:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/refresh-kb
```

A correct secret returns `{"ok":true,"triggered":true}` and starts a
deployment; anything else returns 401.

## Development notes

Stop the dev server before `npm run build`. Both write to the same `.next`
directory, and a concurrent build leaves the dev server throwing
`Cannot find module './xxx.js'` until the directory is deleted.

## Build order

Tracked in `QUNDUZ_CLAUDE_CODE_BRIEF.md` §12.

1. ✅ Scaffold, design tokens, landing page with the breathing Qunduz
2. ✅ Scraper → `data/kb.json`
3. ✅ `lib/search.ts` + `/api/chat`
4. ✅ Stage UI, orb, product cards, transcript
5. ✅ `/api/tts` + audio-driven lip sync
6. ✅ Speech input
7. ✅ Cron refresh, deploy
