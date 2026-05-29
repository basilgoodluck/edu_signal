# EduSignal Backend

FastAPI backend for the EduSignal district learning intelligence platform.

## Quick start

**Prerequisites:** Docker, Python 3.11+, pip

### 1. Start infrastructure

```bash
# From repo root
docker compose up -d
```

Postgres (pgvector) on `localhost:5434`, Redis on `localhost:6381`.

### 2. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and add your BRIGHTDATA_API_KEY and ANTHROPIC_API_KEY
```

### 4. Seed the database

```bash
cd backend
python seed.py
```

Loads 30 sample districts across 5 root-cause clusters with pre-assigned evidence cards.

### 5. Start the API

```bash
cd backend
uvicorn main:app --reload
```

API runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

---

## Run the ML clustering pipeline

After importing real ASER data into `district_features`:

```bash
cd backend
python -m ml.train
```

Runs HDBSCAN clustering on feature matrix, computes SHAP values, writes results to `cluster_assignments`.

---

## Start the Celery worker (for live scraping)

```bash
cd backend
celery -A tasks.scrape_jobs.celery_app worker --loglevel=info
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health |
| `GET` | `/districts` | All districts with cluster labels |
| `GET` | `/districts/{id}` | Full district profile with evidence, peers, SHAP |
| `GET` | `/cluster/{id}/peers` | Districts in same cluster |
| `GET` | `/cluster/{id}/interventions` | Interventions ranked by ASER delta |
| `POST` | `/analyze` | Trigger live Bright Data scrape for a district |
| `GET` | `/analyze/{job_id}` | Poll scrape job status |
| `POST` | `/evidence/classify` | Classify a piece of evidence against a cluster hypothesis |

---

## Cluster IDs

| ID | Label |
|----|-------|
| 0 | `seasonal_migration` |
| 1 | `teacher_shortage` |
| 2 | `infrastructure` |
| 3 | `language_barrier` |
| 4 | `pedagogical_failure` |

---

## Project structure

```
backend/
  main.py           — FastAPI app, CORS, lifespan
  config.py         — env vars
  db/
    session.py      — asyncpg pool with JSONB codec
    schema.sql      — PostgreSQL schema (pgvector)
  models/
    schemas.py      — Pydantic request/response models
  routers/
    districts.py    — /districts endpoints
    clusters.py     — /cluster endpoints
    evidence.py     — /evidence/classify endpoint
    analyze.py      — /analyze endpoints
  services/         — (reserved for future services)
  workers/          — (reserved for future async utils)
  tasks/
    scrape_jobs.py  — Celery scrape task
  ml/
    features.py     — feature matrix extraction from DB
    train.py        — HDBSCAN clustering + SHAP pipeline
  seed.py           — 30-district demo seed

scrapers/           — (at repo root, imported by backend)
  classifier.py     — LLM evidence classification via Claude
  news_serp.py      — Bright Data SERP scraping
  vacancy_portal.py — State teacher vacancy portal scraping
  ngo_reports.py    — NGO and state edu dept scraping
  forums.py         — Community forum scraping
```
