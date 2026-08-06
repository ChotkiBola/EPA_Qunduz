# Qunduz — EPA AI sotuvchi

Uzbek-language AI sales assistant for [epa.uz](https://epa.uz): an animated beaver
mascot that answers catalogue questions by text or voice.

Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel. All secrets stay
server-side — no key ever reaches the browser.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `/api/chat` |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` | `/api/tts` |
| `CRON_SECRET` | `/api/refresh-kb` (daily cron) |

`.env.local` is git-ignored. Never commit real keys.

## Knowledge base

`data/kb.json` holds the scraped EPA catalogue (940 products, 95 categories) in the
compact shape described in the build brief. It currently ships from the verified
snapshot; `npm run scrape` regenerates it once the scraper lands.

## Build order

Tracked in `QUNDUZ_CLAUDE_CODE_BRIEF.md` §12. Done so far:

1. ✅ Scaffold, design tokens, landing page with the breathing Qunduz
2. ⬜ Scraper → `data/kb.json`
3. ⬜ `lib/search.ts` + `/api/chat`
4. ⬜ Stage UI, orb, product cards, transcript
5. ⬜ `/api/tts` + audio-driven lip sync
6. ⬜ Speech input
7. ⬜ Cron refresh, README, deploy
