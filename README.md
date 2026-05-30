<div align="center">

<br/>

```
███████╗██████╗ ██╗   ██╗    ███████╗██╗ ██████╗ ███╗   ██╗ █████╗ ██╗
██╔════╝██╔══██╗██║   ██║    ██╔════╝██║██╔════╝ ████╗  ██║██╔══██╗██║
█████╗  ██║  ██║██║   ██║    ███████╗██║██║  ███╗██╔██╗ ██║███████║██║
██╔══╝  ██║  ██║██║   ██║    ╚════██║██║██║   ██║██║╚██╗██║██╔══██║██║
███████╗██████╔╝╚██████╔╝    ███████║██║╚██████╔╝██║ ╚████║██║  ██║███████╗
╚══════╝╚═════╝  ╚═════╝     ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
```

**District-level root cause classifier for learning outcomes in India.**

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Celery](https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white)](https://docs.celeryq.dev)
[![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)

<br/>

> *India's education policy fails not because of bad intent, but bad diagnosis.*
> *ASER tells districts **that** outcomes are low. EduSignal tells them **why**.*

<br/>

</div>

---

## 📌 What is EduSignal?

EduSignal takes five years of ASER data, crosses it with live ground truth (Bright Data scraping + satellite imagery), and clusters districts by the **structural cause** of their underperformance — not just the severity.

Every classification traces back to a raw source. No black boxes.

---

## 🧠 The Five Root Cause Clusters

| # | Cluster | Key Signal | Recommended Intervention |
|---|---------|------------|--------------------------|
| 1 | 🌾 **Seasonal Migration** | NDVI harvest variance + migration news | Bridge curriculum Oct–Dec |
| 2 | 🗣️ **Language Mismatch** | Gender/language gap, forum complaints | Mother-tongue multilingual education |
| 3 | 👩‍🏫 **Teacher Shortage** | High vacancy rate + PTR | Para-teacher deployment |
| 4 | 🏚️ **Infrastructure Disruption** | Flood days + low infra score | Emergency reconstruction |
| 5 | 📚 **Pedagogical Failure** | Good inputs, broken outcomes | FLN structured lesson plans |

For each district, a DEO sees:
- A **cause cluster** with a confidence score
- A **traceable evidence trail** — raw headline, satellite reading, portal count — before the label
- **SHAP attribution** — which features actually drove the classification

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + plain CSS variables |
| **Mapping** | SVG-based India map (custom) |
| **Backend** | FastAPI (Python 3.11+) |
| **ML** | KMeans / HDBSCAN + UMAP + SHAP + scikit-learn |
| **NLP** | AIMLAPI (gemini-2.5-pro) — evidence classification + AI chat |
| **Live Data** | Bright Data (SERP API + Web Unlocker) |
| **Queue** | Celery + Redis |
| **Database** | PostgreSQL + pgvector |
| **Infra** | Docker + docker-compose |

---

## ⚙️ Prerequisites

Before you start, make sure you have:

- **Docker** + **Docker Compose**
- **Node.js** 18+
- **Python** 3.11+
- A [Bright Data](https://brightdata.com) account → API key
- An [AIMLAPI](https://aimlapi.com) account → API key

---

## 🚀 Getting Started

### 1 — Clone the repo

```bash
git clone https://github.com/basilgoodluck/edu_signal.git
cd edu_signal
```

### 2 — Configure environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your credentials:

```env
DATABASE_URL=postgresql://edusignal:edusignal@localhost:5434/edusignal
REDIS_URL=redis://localhost:6381/0

BRIGHTDATA_API_KEY=<your_brightdata_api_key>
BRIGHTDATA_ZONE=serp_api3

AIMLAPI_API_KEY=<your_aimlapi_api_key>
AIMLAPI_MODEL=google/gemini-2.5-pro

FRONTEND_ORIGIN=http://localhost:5173
```

### 3 — Start the database and Redis

```bash
docker compose up db redis -d
```

Wait for the DB to be healthy:

```bash
docker compose ps   # STATUS should show "(healthy)" for db
```

### 4 — Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

> **Arch/Manjaro users:** `pip install --break-system-packages -r backend/requirements.txt`
>
> Or use a virtualenv:
> ```bash
> python -m venv .venv && source .venv/bin/activate
> pip install -r backend/requirements.txt
> ```

### 5 — Run the backend

```bash
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify it's running:

```bash
curl http://localhost:8000/health   # → {"status":"ok"}
```

### 6 — Seed the database

```bash
cd backend && python seed.py
```

This creates 30 districts across 5 cause clusters with synthetic features, sample evidence for Shravasti, interventions, and a demo model run.

### 7 — (Optional) Load real ASER data

If you have `aser_5year_dataset.csv`:

```bash
cd backend
DATABASE_URL=postgresql://edusignal:edusignal@localhost:5434/edusignal \
python ingest_aser.py /path/to/aser_5year_dataset.csv
```

Loads 2019–2023 state-level reading and arithmetic scores into `aser_outcomes` and patches real values into district features.

### 8 — Run ML training

```bash
cd backend
DATABASE_URL=postgresql://edusignal:edusignal@localhost:5434/edusignal \
REDIS_URL=redis://localhost:6381/0 \
python -m ml.train
```

Runs KMeans/HDBSCAN + UMAP + SHAP on district features, writes cluster assignments back to the database, and stores projection points for the Signal Lab view. Re-run whenever features are updated.

```bash
# Or with Docker:
docker compose run --rm ml
```

### 9 — Install and run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🐳 Full Docker Setup

To run every service containerised:

```bash
# Build all images
docker compose build

# Start DB, Redis, API, and Celery worker
docker compose up

# Seed the database
docker compose exec api python seed.py

# Run ML training
docker compose run --rm ml
```

> The frontend still runs locally with `npm run dev` — it proxies `/api` to port 8000.

---

## 🗂️ Project Structure

```
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
│   │   ├── districts.py     # /api/districts/*
│   │   ├── clusters.py      # /api/clusters/*
│   │   ├── evidence.py      # /api/evidence/*
│   │   ├── ai.py            # /api/ai/chat + /api/ai/insights
│   │   ├── pipeline.py      # /api/pipeline/*
│   │   └── analytics.py     # /api/analytics/*
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
│   └── Dockerfile.ml
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── views/
│   │   │   ├── OverviewView.jsx    # Map + KPI + leaderboard
│   │   │   ├── DistrictView.jsx   # District detail + SHAP + evidence
│   │   │   ├── AIView.jsx         # AI analyst panel + chatbot
│   │   │   ├── EvidenceView.jsx   # Evidence feed + scan console
│   │   │   ├── AnalyticsView.jsx  # Signal Lab (UMAP + SHAP charts)
│   │   │   ├── ClustersView.jsx   # Cause cluster cards
│   │   │   └── WorkflowView.jsx   # Tracker, Alerts, Peers
│   │   ├── components/
│   │   │   ├── UI.jsx             # Design system components
│   │   │   ├── Charts.jsx         # UMAP, SHAP beeswarm, TrendChart, RadarChart
│   │   │   └── Map.jsx            # SVG India map
│   │   └── api/                   # Typed fetch wrappers per domain
│   └── vite.config.js             # Proxy: /api → localhost:8000
└── docker-compose.yml
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness check |
| `GET` | `/api/overview` | National KPIs + cluster counts |
| `GET` | `/api/districts/map` | All districts with lat/lng + cluster |
| `GET` | `/api/districts/{id}` | Full district detail + SHAP + evidence |
| `GET` | `/api/districts/{id}/peers` | Same-cluster peer districts |
| `POST` | `/api/districts/{id}/scan` | Queue a Bright Data scan |
| `GET` | `/api/evidence` | Evidence feed (filterable by `districtId`) |
| `GET` | `/api/clusters` | All cluster metadata |
| `POST` | `/api/ai/chat` | AI analyst chat (streams via SSE) |
| `GET` | `/api/ai/insights` | Auto-generated district insights |
| `GET` | `/api/pipeline/overview` | Pipeline stage status |

---

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b yourname/feature-name`
3. Make your changes
4. Push to your fork: `git push origin yourname/feature-name`
5. Open a PR against `basilgoodluck/edu_signal:main`

Please keep PRs focused — one problem, one fix. If you're unsure whether something is in scope, open an issue first.

---

## 🎯 Demo Target

**Shravasti, Uttar Pradesh** — consistently the lowest ASER scores in the country, known seasonal migration pattern, active teacher vacancy issues.

**Demo flow:** `map → cluster badge → evidence cards → peer districts → interventions → SHAP waterfall → AI analyst`

> *"Every other tool tells you Shravasti is failing.*
> *We tell you it's failing in October because the kids are in the fields."*

---

<div align="center">

Built to fix diagnosis before prescription. <br/>
**EduSignal** — because knowing *why* is the whole job.

</div>