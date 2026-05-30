  # EduSignal

  **District-level root cause classifier for learning outcomes in India.**

  India's education policy fails not because of bad intent, but bad diagnosis.
  ASER data tells districts *that* learning outcomes are low.
  EduSignal tells them *why* — and maps every classification back to a raw source.

  ---

  ## What it does

  EduSignal takes five years of ASER data, crosses it with live ground truth
  (Bright Data scraping + satellite imagery), and clusters districts by the
  **structural cause** of their underperformance — not just the severity.

  **The five root cause clusters:**

  | Cluster | Signal | Intervention |
  |---|---|---|
  | Seasonal Migration | NDVI harvest variance + migration news | Bridge curriculum Oct–Dec |
  | Language Mismatch | Gender/language gap, forum complaints | Mother-tongue multilingual education |
  | Teacher Shortage | High vacancy rate + PTR | Para-teacher deployment |
  | Infrastructure Disruption | Flood days + low infra score | Emergency reconstruction |
  | Pedagogical Failure | Good inputs, broken outcomes | FLN structured lesson plans |

  For each district a DEO sees:
  - A **cause cluster** with confidence score
  - A **traceable evidence trail** — raw headline, satellite reading, portal count — before the label
  - **SHAP attribution** — which features drove the classification

  ---

  ## Stack

  | Layer | Tech |
  |---|---|
  | Frontend | React 18 + Vite + plain CSS variables |
  | Mapping | SVG-based India map (custom) |
  | Backend | FastAPI (Python 3.11+) |
  | ML | KMeans / HDBSCAN + UMAP + SHAP + scikit-learn |
  | NLP | AIMLAPI (gemini-2.5-pro) for evidence classification + AI chat |
  | Live Data | Bright Data (SERP API + Web Unlocker) |
  | Queue | Celery + Redis |
  | Database | PostgreSQL + pgvector |
  | Infra | Docker + docker-compose |

  ---

  ## Prerequisites

  - Docker + Docker Compose
  - Node.js 18+
  - Python 3.11+
  - A Bright Data account → API key
  - An AIMLAPI account → API key

  ---

  ## Setup for a new contributor

  ### 1. Clone the repo

  ```bash
  git clone https://github.com/basilgoodluck/edu_signal.git
  cd edu_signal

  2. Create your env file

  cp backend/.env.example backend/.env

  Open backend/.env and fill in:

  DATABASE_URL=postgresql://edusignal:edusignal@localhost:5434/edusignal
  REDIS_URL=redis://localhost:6381/0
  BRIGHTDATA_API_KEY=<your_brightdata_api_key>
  BRIGHTDATA_ZONE=serp_api3
  AIMLAPI_API_KEY=<your_aimlapi_api_key>
  AIMLAPI_MODEL=google/gemini-2.5-pro
  FRONTEND_ORIGIN=http://localhost:5173

  3. Start the database and Redis

  docker compose up db redis -d

  Wait until the DB is healthy:

  docker compose ps   # STATUS should show "(healthy)" for db

  4. Install Python dependencies

  pip install -r backend/requirements.txt

  ▎ On Arch/Manjaro: pip install --break-system-packages -r backend/requirements.txt
  ▎ or create a virtualenv first:
  ▎ python -m venv .venv && source .venv/bin/activate
  ▎ pip install -r backend/requirements.txt

  5. Run the backend

  cd backend
  DATABASE_URL=postgresql://edusignal:edusignal@localhost:5434/edusignal \
  REDIS_URL=redis://localhost:6381/0 \
  FRONTEND_ORIGIN=http://localhost:5173 \
  BRIGHTDATA_API_KEY=<your_key> \
  AIMLAPI_API_KEY=<your_key> \
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  Or if you have a backend/.env file, just:

  cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  Verify it's up:

  curl http://localhost:8000/health   # → {"status":"ok"}

  6. Seed the database

  cd backend
  python seed.py

  This creates 30 districts across 5 cause clusters with synthetic features,
  sample evidence for Shravasti, interventions, and a demo model run.

  7. (Optional) Load real ASER data

  If you have the ASER CSV (aser_5year_dataset.csv):

  cd backend
  DATABASE_URL=postgresql://edusignal:edusignal@localhost:5434/edusignal \
  python ingest_aser.py /path/to/aser_5year_dataset.csv

  This loads 2019–2023 state-level reading and arithmetic scores into the
  aser_outcomes table and patches real values into district features.

  8. Run the ML training

  cd backend
  DATABASE_URL=postgresql://edusignal:edusignal@localhost:5434/edusignal \
  REDIS_URL=redis://localhost:6381/0 \
  python -m ml.train

  This runs KMeans/HDBSCAN + UMAP + SHAP on district features, writes cluster
  assignments back to the database, and stores projection points for the Signal
  Lab view. Re-run whenever features are updated.

  Or with Docker:

  docker compose run --rm ml

  9. Install and run the frontend

  cd frontend
  npm install
  npm run dev

  Open http://localhost:5173 in your browser.

  ---
  Full Docker setup (all services)

  If you want everything containerised:

  # Build all images
  docker compose build

  # Start DB, Redis, API, and Celery worker
  docker compose up

  # In a separate terminal, seed the database
  docker compose exec api python seed.py

  # Run ML training
  docker compose run --rm ml

  Frontend still runs locally with npm run dev (it proxies /api to port 8000).

  ---
  Project structure

  edu_signal/
  ├── backend/
  │   ├── main.py              # FastAPI app + router registration
  │   ├── config.py            # Env var loading
  │   ├── seed.py              # Demo data seeder (30 districts)
  │   ├── ingest_aser.py       # ASER CSV → aser_outcomes table
  │   ├── db/
  │   │   ├── schema.sql       # All table definitions
  │   │   └── session.py       # asyncpg connection pool
  │   ├── dto/
  │   │   └── mappers.py       # DB row → API response shape
  │   ├── ml/
  │   │   ├── train.py         # KMeans/HDBSCAN + SHAP training script
  │   │   └── features.py      # Feature matrix builder
  │   ├── routers/
  │   │   ├── districts.py     # /api/districts/* endpoints
  │   │   ├── clusters.py      # /api/clusters/*
  │   │   ├── evidence.py      # /api/evidence/*
  │   │   ├── ai.py            # /api/ai/chat + /api/ai/insights
  │   │   ├── pipeline.py      # /api/pipeline/*
  │   │   ├── analytics.py     # /api/analytics/*
  │   │   └── ...
  │   ├── scrapers/
  │   │   ├── news_serp.py     # Bright Data Google SERP scraper
  │   │   ├── vacancy_portal.py
  │   │   ├── ngo_reports.py
  │   │   ├── forums.py
  │   │   └── classifier.py    # AIMLAPI evidence classifier
  │   ├── tasks/
  │   │   └── scrape_jobs.py   # Celery task for district scans
  │   ├── Dockerfile.api
  │   ├── Dockerfile.worker
  │   └── Dockerfile.ml        # Standalone ML training image
  ├── frontend/
  │   ├── src/
  │   │   ├── App.jsx          # Shell, routing, AI panel toggle
  │   │   ├── views/
  │   │   │   ├── OverviewView.jsx    # Map + KPI + leaderboard
  │   │   │   ├── DistrictView.jsx   # District detail + SHAP + evidence
  │   │   │   ├── AIView.jsx         # AI analyst panel + chatbot
  │   │   │   ├── EvidenceView.jsx   # Evidence feed + scan console
  │   │   │   ├── AnalyticsView.jsx  # Signal Lab (UMAP + SHAP charts)
  │   │   │   ├── ClustersView.jsx   # Cause cluster cards
  │   │   │   └── WorkflowView.jsx   # Tracker, Alerts, Peers
  │   │   ├── components/
  │   │   │   ├── UI.jsx       # Design system (Button, Card, ClusterDot…)
  │   │   │   ├── Charts.jsx   # UMAP, SHAP beeswarm, TrendChart, RadarChart
  │   │   │   └── Map.jsx      # SVG India map
  │   │   └── api/             # Typed fetch wrappers per domain
  │   └── vite.config.js       # Proxy: /api → localhost:8000
  └── docker-compose.yml

  ---
  Key API endpoints

  ┌────────┬───────────────────────────┬────────────────────────────────────────┐
  │ Method │           Path            │              What it does              │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /health                   │ Liveness check                         │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/overview             │ National KPIs + cluster counts         │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/districts/map        │ All districts with lat/lng + cluster   │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/districts/{id}       │ Full district detail + SHAP + evidence │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/districts/{id}/peers │ Same-cluster peer districts            │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/districts/{id}/scan  │ Queue a Bright Data scan               │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/evidence             │ Evidence feed (filter by districtId)   │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/clusters             │ All cluster metadata                   │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ POST   │ /api/ai/chat              │ AI analyst chat (streams via SSE)      │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/ai/insights          │ Auto-generated insights                │
  ├────────┼───────────────────────────┼────────────────────────────────────────┤
  │ GET    │ /api/pipeline/overview    │ Pipeline stage status                  │
  └────────┴───────────────────────────┴────────────────────────────────────────┘

  ---
  Contributing

  1. Fork the repo
  2. Create a branch: git checkout -b yourname/feature-name
  3. Make your changes
  4. Push to your fork: git push origin yourname/feature-name
  5. Open a PR against basilgoodluck/edu_signal:main

  ---
  Demo target

  Shravasti, UP — consistently lowest ASER scores, known migration pattern,
  active vacancy issues.

  Demo flow: map → cluster badge → evidence cards → peer districts →
  interventions → SHAP waterfall → AI analyst.

  "Every other tool tells you Shravasti is failing. We tell you it's failing
  in October because the kids are in the fields."

  ---

  Copy the entire block into `README.md` at the root of the repo. Covers everything — setup, env vars, Docker, ML training, project structure, API reference, and
  contribution flow — so anyone can clone and run it from zero.