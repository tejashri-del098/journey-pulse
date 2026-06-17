# 🧭 JourneyPulse

> **Don't A/B test on real people — rehearse your campaign on an AI focus group that remembers yesterday's message.**

Built for the **TeXpedition Hackathon** · Epsilon · **Theme 2: Connected Customer Journeys**

---

## 🎯 Theme 2 Alignment

Modern marketing demands connected, multi-step customer journeys — not isolated blasts. But testing those journeys on real customers is expensive, slow, and risks brand damage.

**JourneyPulse** lets marketers simulate entire campaign journeys against a synthetic audience of AI-generated personas *before* a single real email is sent. Each persona carries persistent memory — they remember the last touchpoint, accumulate fatigue, shift sentiment, and react differently based on segment, channel preference, and privacy comfort. The result is a realistic rehearsal of connected customer journeys, complete with per-segment engagement scores and actionable optimization suggestions.

---

## 🚀 Quick Setup

```bash
# 1. Clone the repo
git clone <repo-url> && cd journey-pulse

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment
cp .env.example .env
# Open .env and add your Google Gemini API key

# 4. Generate the synthetic persona panel
npm run generate-personas

# 5. Start the dev server (auto-reloads on save)
npm run dev
```

The server will start at **http://localhost:3001**. Hit `/api/health` to verify.

---

## 🏗️ Architecture Overview

```
┌──────────────┐        ┌──────────────────────────────────┐
│   Frontend   │◄──────►│         Express API Server        │
│  (React/Vue) │  REST  │                                  │
└──────────────┘        │  /api/simulate   → SimulationSvc │
                        │  /api/variants   → VariantSvc    │
                        │  /api/journey    → JourneySvc    │
                        │  /api/calibrate  → CalibrationSvc│
                        └────────┬─────────────────────────┘
                                 │
                     ┌───────────┴───────────┐
                     │   Google Gemini API   │
                     │  gemini-2.0-flash     │
                     │  text-embedding-004   │
                     └───────────────────────┘
                                 │
                     ┌───────────┴───────────┐
                     │   JSON File Storage   │
                     │  personas.json        │
                     │  journeys.json        │
                     │  embeddings cache     │
                     └───────────────────────┘
```

- **Persona Panel** — 200 synthetic personas across 4 segments, each with backstory, preferences, and an embedding vector.
- **Simulation Engine** — Batches personas (10-15 per LLM call) through Gemini with structured JSON output for speed.
- **Journey Memory** — Each persona accumulates a persistent interaction history; fatigue, mood, and sentiment evolve over steps.
- **Vector Search** — Cosine-similarity over `text-embedding-004` vectors to find personas most relevant to a campaign message.
- **Variant Generator** — LLM-powered A/B/C copy generation with per-segment tone calibration.

---

## 📡 API Endpoints

| Method | Endpoint            | Description                                      |
| ------ | ------------------- | ------------------------------------------------ |
| GET    | `/api/health`       | Health check                                     |
| POST   | `/api/simulate`     | Run personas through a campaign message           |
| POST   | `/api/variants`     | Generate A/B/C message variants via LLM          |
| GET    | `/api/journey/:id`  | Retrieve multi-step journey history for a persona |
| POST   | `/api/calibrate`    | Tune persona parameters & validate realism       |

---

## 🛠️ Tech Stack

| Layer        | Technology                                        |
| ------------ | ------------------------------------------------- |
| Runtime      | Node.js 20+                                       |
| Framework    | Express.js                                        |
| LLM          | Google Gemini API (`gemini-2.0-flash`)             |
| Embeddings   | Google `text-embedding-004`                        |
| Vector Search| Cosine similarity (no FAISS)                      |
| Storage      | JSON file storage (no database)                   |
| Modules      | ES Modules (`"type": "module"`)                   |
| Caching      | `lru-cache` for embedding & LLM response caching  |

---

## 📂 Project Structure

```
journey-pulse/
├── README.md
└── backend/
    ├── package.json
    ├── .env.example
    └── src/
        ├── server.js            # Express entry point
        ├── config/              # Env & model configuration
        ├── services/            # Core business logic
        │   ├── geminiService.js
        │   ├── personaService.js
        │   ├── simulationService.js
        │   └── embeddingService.js
        ├── routes/              # API route handlers
        │   ├── simulate.js
        │   ├── variants.js
        │   ├── journey.js
        │   └── calibrate.js
        ├── data/                # Generated JSON data files
        │   ├── personas.json
        │   └── journeys.json
        └── scripts/             # CLI utilities
            ├── generatePersonas.js
            └── testCampaigns.js
```

---

## 📄 License

MIT — Built with ❤️ for the TeXpedition Hackathon.
