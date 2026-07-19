# ZENITH — AI Goal Command Center

A phone-first goal tracking app with three AI coach agents that push you hard:

- **IRON** — Health: training, nutrition, sleep, recovery
- **NORTH** — Personal: relationships, character, habits, money
- **CLIMB** — Professional: career, skills, output, income

## What it does

- **Talk goals in, get structure out.** Tell a coach what you're chasing in plain
  words. The agent sharpens it (metric, target, deadline) and files it as a
  structured goal via Claude tool use — same for progress check-ins.
- **Dashboard** — momentum score, day streak, progress rings per life area,
  today's action items, and an honest "where you're winning / where you're
  slipping" assessment.
- **Goals board** — every goal filtered by timeframe (daily, weekly, monthly,
  yearly, short-term, long-term) and by life area.
- **The Plan** — AI-generated daily and weekly attack plans: not goals, but the
  specific actions (with real dates and times) that get you there, weighted
  toward whatever you're behind on.

All data (goals, chats, plans, API key) lives in your browser's local storage —
nothing is stored on any server. AI calls go directly from your phone to
Anthropic's API.

## Setup

1. Push (or merge) — the included workflow builds, **auto-enables GitHub Pages**,
   and deploys. Your app URL: `https://<username>.github.io/goals/`.
   (If the very first deploy fails, enable it once manually: repo → Settings →
   Pages → Source: **GitHub Actions**, then re-run the workflow.)
2. Open the URL on your phone — the welcome screen walks you through creating a
   free Anthropic API key and pasting it in.
3. **Install it**: Safari → Share → *Add to Home Screen* (iPhone), or Chrome →
   ⋮ → *Add to Home screen* (Android). It runs full-screen like a native app.
4. Hit **🧠 Brain dump** on the Goals tab, paste everything you want to achieve,
   and the AI sorts it into structured goals — or talk to the coaches one on one.

## Development

```bash
npm install
npm run dev     # local dev server
npm run build   # production build to dist/
```

Stack: Vite + React + TypeScript, `@anthropic-ai/sdk` (browser mode), Claude
Opus 4.8 with adaptive thinking and tool use for structured goal extraction.

## Notes

- Your API key is stored only in local storage on your device and sent only to
  `api.anthropic.com`. Don't use this app on a shared/public computer.
- Export a JSON backup now and then (Setup tab) — clearing browser site data
  wipes the app.
