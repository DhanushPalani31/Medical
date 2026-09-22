# Prescription Prediction — Conversational Demo (Phase 2)

A ChatGPT-style chat interface (with voice input) for the BioMistral-7B prescription
prediction model trained in Phase 1. This is a **MERN**-style app:

- **client/** — React (Vite) chat UI, voice input via the browser's Web Speech API
- **server/** — Node/Express backend that runs a short guided conversation, then
  calls the model's Gradio endpoint (currently hosted on Kaggle) and returns the
  suggested prescription + grounded similar cases
- **MongoDB** — stores conversation history per session (optional — the app runs
  fine without Mongo configured, it just won't persist history across restarts)

## Why a guided conversation, not free-form chat

The trained model needs five structured fields (age, gender, diagnosed condition,
symptoms, history). A raw LLM call to *parse* freeform chat into those fields would
mean a second model call (cost + latency + another failure point) for a demo that
needs to be rock solid. Instead the bot asks for each field conversationally, one
at a time, accepts typed or spoken answers, confirms understanding, and then calls
the trained model. It still *feels* like ChatGPT — message bubbles, streaming-style
responses, a mic button — but the data collection underneath is deterministic and
won't misfire during a client demo.

Swapping in true freeform NLU extraction later (e.g. asking BioMistral itself, or
a cheap classifier, to extract fields from one free-text paragraph) is a natural
Phase 3 step — the backend's `conversationFlow.js` is written so that swap only
touches one function.

## Running it

### 1. Backend

```bash
cd server
cp .env.example .env
# edit .env: set GRADIO_BASE_URL to the current Kaggle gradio.live link
npm install
npm run dev       # http://localhost:4000
```

`MONGO_URI` in `.env` is optional. If it's not set (or Mongo isn't reachable), the
server falls back to an in-memory conversation store automatically — nothing
breaks, you just lose history on restart.

### 2. Frontend

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

The client talks to the backend at `VITE_API_BASE_URL` (defaults to
`http://localhost:4000`, see `client/.env.example`).

## The one thing you'll need to update per demo

Kaggle's free interactive sessions die after ~40 minutes of idleness or on a
timeout even mid-run, which gives the notebook a **new** `*.gradio.live` URL every
time it's relaunched. Before a demo:

1. Open the Kaggle notebook, make sure the session is live, confirm the Gradio
   cell printed a `Running on public URL: https://xxxx.gradio.live` line.
2. Put that URL in `server/.env` as `GRADIO_BASE_URL` and restart the backend
   (or just `PATCH /api/config` if the server is already running — see below).

`GET /api/health` on the backend will tell you immediately whether the configured
Gradio URL is currently reachable, so you can check this in one request instead of
opening Kaggle every time.
