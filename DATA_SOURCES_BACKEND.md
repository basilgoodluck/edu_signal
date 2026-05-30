# Backend Data Sources Report

Audited on 2026-05-30 against the backend codebase and `backend/API_CONTRACT.md`. This report covers configs, database schema, seed script, routers, Celery task, scrapers, ML scripts, models, and deployment files.

## Executive Summary

The backend has five persistent domain tables in PostgreSQL: `districts`, `district_features`, `cluster_assignments`, `evidence`, and `interventions`. Redis is used only as the Celery broker/result backend, not as a domain datastore. Most demo data comes from hardcoded/generated seed constants in `backend/seed.py`; live evidence can be ingested on demand via `POST /analyze`, which runs a Celery scrape job using Bright Data and Gemini.

There is no scheduled ingestion. There are no CSV or JSON domain files. There are no migrations beyond `backend/db/schema.sql`, which is executed at app startup and by the seed script. The ML pipeline is an offline script that reads `district_features`, computes cluster assignments and SHAP values, and writes `cluster_assignments`.

## Storage And Infrastructure

| Store/source | Location | Purpose | Ingestion mode | Notes |
|---|---|---|---|---|
| PostgreSQL + pgvector | `docker-compose.yml`, `backend/db/schema.sql` | Main domain store | App startup creates schema; seed and scripts insert rows | Postgres exposed on host port `5434`; schema enables `pgcrypto` and `vector`. |
| Redis | `docker-compose.yml`, `backend/tasks/scrape_jobs.py:16-18` | Celery broker and result backend | Runtime task queue | Exposed on host port `6381`; no domain tables/collections. |
| Bright Data API | `https://api.brightdata.com/request` | Scraper transport for Google SERP and target web pages | On-demand Celery job | Uses `BRIGHTDATA_API_KEY` and `BRIGHTDATA_ZONE`. |
| Google Gemini API | `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent` | Evidence classification | On-demand during scrape job or `/evidence/classify` | Uses `GEMINI_API_KEY`. |
| `schema.sql` | `backend/db/schema.sql` | Schema definition | Loaded at app startup and seed run | Not a migration system; `CREATE TABLE IF NOT EXISTS` only. |

## Environment And Config

- `DATABASE_URL`: required by `backend/config.py:6`, `backend/db/session.py:8`, and `backend/seed.py:353`; points to PostgreSQL.
- `REDIS_URL`: optional default `redis://localhost:6379/0` in `backend/config.py:7` and `backend/tasks/scrape_jobs.py:16`; used by Celery.
- `BRIGHTDATA_API_KEY`: required by scrapers and `backend/config.py:8`.
- `BRIGHTDATA_ZONE`: optional default `serp_api3`, used by Bright Data requests.
- `GEMINI_API_KEY`: required by `scrapers/classifier.py:5`.

Note: `backend/README.md` mentions `ANTHROPIC_API_KEY`, but the code uses Gemini, not Anthropic.

## Database Tables

### `districts`

- Defined in `backend/db/schema.sql:4-11`.
- Columns: `id`, `name`, `state`, `census_code`, `lat`, `lng`.
- Primary source:
  - Hardcoded demo district list in `backend/seed.py:22-59`.
  - Seed inserts rows in `backend/seed.py:367-378`.
- Ingestion:
  - One-time/manual seed via `python seed.py`.
  - Seed is destructive: truncates all domain tables before inserting, `backend/seed.py:361-365`.
  - No production importer for real district/census data exists.
- Served by:
  - `GET /districts`, query in `backend/routers/districts.py:12-18`.
  - `GET /districts/{district_id}`, query in `backend/routers/districts.py:26-28`.
  - Peer derivations in `GET /districts/{district_id}`, `backend/routers/districts.py:48-58`.
  - `GET /cluster/{cluster_id}/peers`, query in `backend/routers/clusters.py:12-20`.
- Frontend/API contract mapping:
  - Partial source for `District`, `DistrictMapPoint`, leaderboard rows, search results, peer network nodes, and bootstrap districts.
  - Contract endpoints needing this data include `/api/districts/map`, `/api/districts/leaderboard`, `/api/districts/{districtId}`, `/api/search`, `/api/bootstrap`, `/api/peer-network`.
- Gaps:
  - No `stateCode`.
  - No frontend metrics in this table (`reading3`, `arith5`, `yoyReading`, `genderGap`, etc.).
  - No official external source or file import for district master data.
  - No endpoint with the contract path `/api/districts/map`.

### `district_features`

- Defined in `backend/db/schema.sql:13-18`.
- Columns: `district_id`, `year`, `features` JSONB.
- Feature keys:
  - Defined for ML in `backend/ml/features.py:4-19`.
  - Demo ranges in `backend/seed.py:61-142`.
- Primary source:
  - Generated synthetic demo features from `FEATURE_PROFILES` in `backend/seed.py:61-142`.
  - `make_features()` randomly samples values in `backend/seed.py:333-341`.
  - Seed inserts 2023 features in `backend/seed.py:380-390`.
- Ingestion:
  - One-time/manual seed.
  - Offline ML loader reads latest year in `backend/ml/features.py:22-45`.
  - No ASER CSV/API/importer is implemented, although `backend/ml/train.py:5-7` says it is designed for real ASER data.
- Served by:
  - Embedded in `GET /districts/{district_id}` via `backend/routers/districts.py:36-39`.
  - Read by offline ML pipeline in `backend/ml/features.py:27-35`.
- Frontend/API contract mapping:
  - Partial source for District fields: `reading3`, `arith5`, `yoyReading`, `genderGap`, `ptr`, `vacancyRate`, `infraScore`, `ndviVar`, `floodDays`, `roadIdx`, `vacancyPosts`, `newsMigration`, `newsFlood`, `forumComplaints`.
  - Partial source for `/api/districts/{districtId}/features`, `/api/analytics/*`, `/api/districts/{districtId}/radar`, `/api/overview`, and `/api/districts/leaderboard`.
- Gaps:
  - Backend serves raw JSONB as `features`, not contract-shaped feature rows.
  - No historical trend series beyond one seeded year.
  - No true source lineage for feature values; demo values are random within hand-authored ranges.
  - No endpoints for analytics summary, histogram, correlation, radar, cause prevalence, or leaderboard.

### `cluster_assignments`

- Defined in `backend/db/schema.sql:20-28`.
- Columns: `district_id`, `cluster_id`, `cluster_label`, `confidence`, `shap_values`, `assigned_at`.
- Primary sources:
  - Seeded demo clusters from hardcoded district tuples in `backend/seed.py:22-59`.
  - Seeded SHAP templates from `backend/seed.py:144-225`, randomized by `make_shap()` in `backend/seed.py:344-349`.
  - Offline ML output from `backend/ml/train.py:32-136`.
- Ingestion:
  - One-time/manual seed inserts in `backend/seed.py:392-403`.
  - Offline manual ML run with `python -m ml.train`.
  - ML reads latest `district_features` from Postgres, standardizes features, uses HDBSCAN with UMAP for 50+ districts or KMeans for smaller datasets, trains a RandomForest classifier, computes SHAP values, and upserts rows in `backend/ml/train.py:44-133`.
- Served by:
  - `GET /districts`, left join in `backend/routers/districts.py:12-18`.
  - `GET /districts/{district_id}`, query in `backend/routers/districts.py:32-34`.
  - Peer derivation by cluster label in `backend/routers/districts.py:48-58`.
  - Cluster peer lookup by numeric `cluster_id` in `backend/routers/clusters.py:12-20`.
  - Intervention lookup by cluster id in `backend/routers/clusters.py:30-38`.
  - Scrape classifier context reads `cluster_label` in `backend/tasks/scrape_jobs.py:53-58`.
- Frontend/API contract mapping:
  - Partial source for cluster membership, confidence, SHAP, cluster counts, cluster cards, district detail cluster badge, analytics SHAP.
  - Contract endpoints include `/api/navigation/summary`, `/api/overview`, `/api/clusters`, `/api/clusters/{clusterId}`, `/api/analytics/shap`, `/api/districts/{districtId}`.
- Gaps:
  - Contract `ClusterId` is a string union with `pedagogical`; backend uses numeric ids and label `pedagogical_failure`.
  - No table for cluster metadata required by contract: `label`, `short`, `color`, `tint`, `blurb`, `window`, `signature`.
  - No endpoint returns full cluster card summaries.
  - No persisted model version, silhouette score, projection, or trained-at metadata.

### `evidence`

- Defined in `backend/db/schema.sql:30-40`.
- Columns: `id`, `district_id`, `raw_text`, `source_url`, `source_type`, `classification`, `reason`, `embedding`, `scraped_at`.
- Primary sources:
  - Seeded demo evidence for Shravasti in `backend/seed.py:300-330`.
  - Live scrape pipeline in `backend/tasks/scrape_jobs.py:26-96`.
  - Direct classifier endpoint returns classification but does not persist evidence.
- Ingestion:
  - One-time/manual seed inserts demo evidence in `backend/seed.py:423-437`.
  - On-demand Celery scrape job triggered by `POST /analyze`, implemented in `backend/routers/analyze.py:9-20`.
  - Celery task fetches raw items from news, vacancy portals, NGO pages, state education department pages, forums, and grievance portals in `backend/tasks/scrape_jobs.py:36-41`.
  - Candidate scrape items are classified by Gemini, then inserted in `backend/tasks/scrape_jobs.py:60-93`.
- Served by:
  - Embedded in `GET /districts/{district_id}`, query in `backend/routers/districts.py:41-44`.
  - Job status is served by `GET /analyze/{job_id}`, but the saved evidence itself is not returned there.
- Frontend/API contract mapping:
  - Partial source for `EvidenceItem`, evidence feed, evidence summary counts, district detail evidence, scan found items.
  - Contract endpoints include `/api/evidence`, `/api/evidence/summary`, `/api/districts/{districtId}/evidence`, `/api/scans/{scanId}`, `/api/stream/scans/{scanId}`.
- Gaps:
  - No standalone evidence feed endpoint.
  - No summary endpoint for classifications/source counts.
  - No cursor/limit/filter support.
  - `embedding` column exists but no code writes embeddings.
  - Backend source types include `govt_press_release` and `grievance_portal`, which are not in contract `EvidenceSourceType`.
  - Contract field names differ (`raw`, `url`, `date`) from backend fields (`raw_text`, `source_url`, `scraped_at`).

### `interventions`

- Defined in `backend/db/schema.sql:42-49`.
- Columns: `id`, `district_id`, `intervention_type`, `started_at`, `aser_delta`, `notes`.
- Primary source:
  - Hardcoded demo interventions in `backend/seed.py:227-298`.
  - Seed assigns each cluster's interventions to the first district in that cluster in `backend/seed.py:405-421`.
- Ingestion:
  - One-time/manual seed only.
  - No create/update/delete endpoint.
  - No tracker table exists.
- Served by:
  - `GET /cluster/{cluster_id}/interventions`, query in `backend/routers/clusters.py:30-38`.
- Frontend/API contract mapping:
  - Partial source for cluster best intervention and district interventions.
  - Contract endpoints include `/api/clusters/{clusterId}/interventions`, `/api/districts/{districtId}/interventions`, `/api/districts/{districtId}/comparison`, `/api/intervention-tracker`.
- Gaps:
  - Response shape does not match contract `Intervention` (`type`, `districts`, `evidence`, `blurb`, `cluster`, `aserDelta`).
  - No district-specific intervention endpoint.
  - No intervention tracker data model or endpoints.

## External Sources And Scrapers

### News SERP

- Code: `scrapers/news_serp.py`.
- Transport/API: Bright Data `POST https://api.brightdata.com/request`, `scrapers/news_serp.py:45-53`.
- Target endpoint/site: Google Search URL built as `https://www.google.com/search?q=...&gl=in&hl=...&num=...`, `scrapers/news_serp.py:40-43`.
- Queries:
  - Signal keywords in `scrapers/news_serp.py:10-15`: migration, flood, teacher, language.
  - Query shape: `"district" keywords 2024 2025`, `scrapers/news_serp.py:35-37`.
- Ingestion:
  - On-demand via Celery scrape job, `backend/tasks/scrape_jobs.py:36`.
  - Not scheduled.
- Output:
  - Raw scrape item fields: title, snippet, url, source, district, signal_type, query, source_type=`news`, `scrapers/news_serp.py:57-69`.
  - After Gemini classification, saved to `evidence`.
- API/frontend mapping:
  - Backend: embedded in `GET /districts/{district_id}` after saved.
  - Contract: `/api/evidence`, `/api/districts/{districtId}/evidence`, scan streams.
- Gaps:
  - No provenance table for queries, scrape run id, or original raw SERP payload.
  - No schedule or deduplication.

### Teacher Vacancy Portals

- Code: `scrapers/vacancy_portal.py`.
- Transport/API: Bright Data `POST https://api.brightdata.com/request`, `scrapers/vacancy_portal.py:17-32`.
- Target sites:
  - Bihar: `https://bpsc.bih.nic.in/teacher-vacancy`
  - Uttar Pradesh: `https://upsessb.pariksha.nic.in/vacancy`
  - Rajasthan: `https://rsmssb.rajasthan.gov.in/vacancy`
  - Madhya Pradesh: `https://mpesb.mp.gov.in/vacancy`
  - Jharkhand: `https://jssc.nic.in/teacher-vacancy`
  - Defined in `scrapers/vacancy_portal.py:8-14`.
- Ingestion:
  - On-demand via Celery scrape job, `backend/tasks/scrape_jobs.py:37`.
- Output:
  - Raw HTML plus source URL and `source_type=vacancy_portal`, `scrapers/vacancy_portal.py:45-52`.
  - After classification, saved to `evidence`.
- API/frontend mapping:
  - Contract evidence source type `vacancy_portal`.
  - Could also support feature `vacancyPosts`, but there is no parser that extracts structured vacancy counts.
- Gaps:
  - HTML is classified as text; no structured vacancy data extraction.
  - No state beyond five configured states.

### NGO Reports

- Code: `scrapers/ngo_reports.py`.
- Transport/API: Bright Data `POST https://api.brightdata.com/request`, `scrapers/ngo_reports.py:23-37`.
- Target sites:
  - Pratham press releases: `https://www.pratham.org/media/press-releases`
  - Room to Read press releases: `https://www.roomtoread.org/media-center/press-releases`
  - Teach For India news: `https://www.teachforindia.org/news`
  - Defined in `scrapers/ngo_reports.py:8-12`.
- Ingestion:
  - On-demand via Celery scrape job, `backend/tasks/scrape_jobs.py:38`.
- Output:
  - Raw HTML with `source_type=ngo_report`, `scrapers/ngo_reports.py:40-54`.
  - After classification, saved to `evidence`.
- API/frontend mapping:
  - Contract evidence source type `ngo_report`.
- Gaps:
  - No district-specific filtering before fetch; pages are broad source pages.
  - No PDF/report parser.

### State Education Departments

- Code: `scrapers/ngo_reports.py`.
- Transport/API: Bright Data request, same as above.
- Target sites:
  - Bihar education department: `https://state.bihar.gov.in/educationDept/CitizenHome.html`
  - Uttar Pradesh: `https://upedu.gov.in/`
  - Rajasthan: `https://rajshaladarpan.nic.in/`
  - Madhya Pradesh: `https://educationportal.mp.gov.in/`
  - Jharkhand: `https://jac.jharkhand.gov.in/jac/`
  - Defined in `scrapers/ngo_reports.py:14-20`.
- Ingestion:
  - On-demand via Celery scrape job, `backend/tasks/scrape_jobs.py:39`.
- Output:
  - Raw HTML with `source_type=govt_press_release`, `scrapers/ngo_reports.py:57-74`.
  - After classification, saved to `evidence`.
- API/frontend mapping:
  - Backend evidence only.
- Gaps:
  - `govt_press_release` is not a valid contract `EvidenceSourceType`.
  - No structured extraction from government pages.

### Forums

- Code: `scrapers/forums.py`.
- Transport/API: Bright Data request, `scrapers/forums.py:28-42`.
- Target site:
  - LocalCircles district community URL template `https://www.localcircles.com/a/community/{district_slug}#school`, `scrapers/forums.py:8-12`.
- Ingestion:
  - On-demand via Celery scrape job, `backend/tasks/scrape_jobs.py:40`.
- Output:
  - Raw HTML with `source_type=forum`, `scrapers/forums.py:45-63`.
  - After classification, saved to `evidence`.
- API/frontend mapping:
  - Contract evidence source type `forum`.
  - Could support `forumComplaints` feature, but no structured parser exists.
- Gaps:
  - No count extraction for complaints.
  - No authentication/session handling for forum content.

### Grievance Portals

- Code: `scrapers/forums.py`.
- Transport/API: Bright Data request.
- Target sites:
  - Bihar: `https://grievance.bihar.gov.in/`
  - Uttar Pradesh: `https://jansunwai.up.nic.in/`
  - Rajasthan: `https://sampark.rajasthan.gov.in/`
  - Madhya Pradesh: `https://samadhan.mp.gov.in/`
  - Jharkhand: `https://grievance.jharkhand.gov.in/`
  - Defined in `scrapers/forums.py:15-21`.
- Ingestion:
  - On-demand via Celery scrape job, `backend/tasks/scrape_jobs.py:41`.
- Output:
  - Raw HTML with `source_type=grievance_portal`, `scrapers/forums.py:66-83`.
  - After classification, saved to `evidence`.
- API/frontend mapping:
  - Backend evidence only.
- Gaps:
  - `grievance_portal` is not in contract `EvidenceSourceType`.
  - No structured grievance scraping, search, or school-topic filtering.

### Gemini Evidence Classifier

- Code: `scrapers/classifier.py`.
- External API: Gemini generateContent endpoint in `scrapers/classifier.py:6-9`.
- Input:
  - `evidence_text` and `cluster_type`.
  - Cluster hypotheses in `scrapers/classifier.py:11-17`.
- Ingestion/processing:
  - Called on demand by `POST /evidence/classify`, `backend/routers/evidence.py:7-15`.
  - Called during Celery scrape jobs before inserting evidence, `backend/tasks/scrape_jobs.py:75-93`.
- Output:
  - Parsed `raw`, `classification`, `reason`, plus `cluster_type` and `hypothesis`, `scrapers/classifier.py:35-77`.
  - Persisted only when called from the Celery scrape job.
- API/frontend mapping:
  - Direct backend endpoint is extra and not in API contract.
  - Persisted classifications map to contract `EvidenceClassification`.
- Gaps:
  - No validation that Gemini returns only allowed labels.
  - No audit trail of model prompt/response.
  - No retry result logging beyond HTTP backoff.

## ML Outputs

### Feature Matrix

- Source: latest `district_features.features` per district.
- Loader: `backend/ml/features.py:22-45`.
- Feature columns: `backend/ml/features.py:4-19`.
- Ingestion mode: offline script read path only; it does not create features.
- Output: pandas DataFrame and district id list used by clustering.
- Gaps:
  - No endpoint returns the feature matrix.
  - No data quality checks for missing fields beyond defaulting missing values to `0.0`.

### Cluster Assignments And SHAP

- Source: `district_features` table.
- Model:
  - StandardScaler, UMAP + HDBSCAN for 50+ districts, otherwise KMeans, `backend/ml/train.py:44-71`.
  - RandomForestClassifier and SHAP TreeExplainer for feature attributions, `backend/ml/train.py:84-91`.
- Storage:
  - Upserts to `cluster_assignments`, `backend/ml/train.py:116-133`.
- Ingestion mode:
  - Manual offline command `python -m ml.train`.
  - No scheduler or API trigger.
- Served by:
  - `GET /districts`, `GET /districts/{district_id}`, cluster peer/intervention routes.
- Contract mapping:
  - Needed for `/api/analytics/summary`, `/api/analytics/shap`, `/api/analytics/embedding`, `/api/clusters`, `/api/districts/{districtId}`.
- Gaps:
  - No persisted model artifacts, projection coordinates, silhouette score, model version, or trained timestamp.
  - No analytics endpoints.
  - Seeded demo SHAP and ML-generated SHAP share the same storage but have different provenance.

## API Endpoint To Data Map

| Backend endpoint | Data served/processed | Source tables/services | Frontend contract mapping | Consuming views per contract |
|---|---|---|---|---|
| `GET /health` | Static service status | Computed literal | Not in contract | None |
| `GET /districts` | District list with cluster label/confidence | `districts`, `cluster_assignments` | Partial for `/api/districts/map`, `/api/search`, `/api/bootstrap` | App shell search, Overview map, Analytics dropdown |
| `GET /districts/{district_id}` | District, cluster assignment, latest features, evidence, peer districts | `districts`, `cluster_assignments`, `district_features`, `evidence` | Partial for `/api/districts/{districtId}` and district subresources | District Detail, Evidence, Analytics radar, Peer workflows |
| `GET /cluster/{cluster_id}/peers` | Districts in same numeric cluster | `districts`, `cluster_assignments` | Partial for `/api/clusters/{clusterId}/districts`; possibly `/api/peer-network` | Cause Clusters, Workflow peers |
| `GET /cluster/{cluster_id}/interventions` | Interventions joined by cluster assignment | `interventions`, `cluster_assignments` | Partial for `/api/clusters/{clusterId}/interventions` | Cause Clusters |
| `POST /analyze` | Starts scrape/classification job for district | `districts`, Celery, Redis | Partial for `/api/scans` and `/api/districts/{districtId}/scan` | Evidence Engine, District Detail scan |
| `GET /analyze/{job_id}` | Celery job state/result | Redis Celery backend | Partial for `/api/scans/{scanId}` | Evidence Engine scan status |
| `POST /evidence/classify` | Classification result for ad hoc evidence text | Gemini API | Not in contract | None directly |

## Pipeline And ETL

### App startup schema creation

- Trigger: FastAPI lifespan calls `init_db()` in `backend/main.py:13-16`.
- Work: `init_db()` reads `db/schema.sql` and executes it, `backend/db/session.py:36-39`.
- Type: Startup schema bootstrap.
- Gap: No versioned migrations, no destructive/alter migration strategy.

### Seed pipeline

- Trigger: Manual `python seed.py`.
- Work:
  - Reads `backend/db/schema.sql`.
  - Truncates domain tables.
  - Inserts districts, features, cluster assignments, interventions, sample evidence.
- Type: One-time/manual demo load.
- Gap: Not production ETL; synthetic features and static prose evidence.

### Live scrape pipeline

- Trigger: HTTP `POST /analyze` with `district_id`, `backend/routers/analyze.py:9-20`.
- Queue: Celery task `run_scrape_job`, Redis broker/backend, `backend/tasks/scrape_jobs.py:18-23`.
- Work:
  - Load district from DB.
  - Scrape all configured sources.
  - Read district cluster label.
  - Select up to 10 candidates.
  - Classify with Gemini.
  - Insert evidence rows.
- Type: On-demand per request.
- Gap: No schedule, no SSE progress, no scan table, no run history, no dedupe, no structured feature updates.

### ML pipeline

- Trigger: Manual `python -m ml.train`.
- Work:
  - Reads latest `district_features`.
  - Computes clusters and SHAP.
  - Upserts `cluster_assignments`.
- Type: Offline/manual ETL/ML output.
- Gap: No model registry, artifact table, versioning, projections, status stream, or API trigger.

## CSV / JSON / File Inputs

- No CSV files are read by backend code.
- No JSON domain data files are read by backend code.
- `backend/db/schema.sql` is read by `backend/db/session.py:38-39` and `backend/seed.py:357-359`.
- `district_features.features`, `cluster_assignments.shap_values`, and other JSON-like values are stored in PostgreSQL JSONB, not local JSON files.

## Data The Frontend Expects But Backend Has No Source For

### App shell

- User identity (`/api/me`): no user table, auth provider, session, or profile source.
- Navigation summary high alert count: no alerts table.
- Pipeline status and sources label: no pipeline status table or telemetry source.
- Server-side search views/clusters: no route; cluster metadata is not stored.
- App summary SSE: no event source.

### Overview

- State coverage and state-level map summaries: no state metadata aggregation endpoint.
- Live evidence count: can be derived from `evidence`, but no endpoint exists.
- Dominant cluster label/district count: can be derived from `cluster_assignments`, but no contract endpoint.
- Leaderboard and trends: no trend table; seeded features only include one year.

### Analytics / Signal Lab

- Silhouette score: not persisted by ML script.
- Model version and trainedAt: not stored.
- Embedding/projection points: UMAP reduction is transient and not saved.
- Cause prevalence over years: no historical cluster assignment table.
- Histogram and correlation: can be computed from `district_features`, but no endpoint.
- Radar series for district/cluster/national avg: partially computable, no endpoint or national average source.

### Pipeline

- Pipeline sources, stages, observability stats, throughput sparkline, source health: no tables, task event log, or endpoint.
- Pipeline SSE: not implemented.

### Clusters

- Cluster metadata (`label`, `short`, `color`, `tint`, `blurb`, `window`, `signature`): no backend table/source.
- Cluster card summaries: derivable partially, no endpoint.
- Best intervention in contract shape: no `evidence` count or `blurb` field; only `notes`.

### District Detail

- Many contract district fields can be mapped from JSON feature keys but are not transformed.
- `stateCode`: no source.
- `trend`: no multi-year feature/trend source.
- `peers` with metrics/cluster: current peer query returns only district rows.
- `interventions` in detail response: no implemented district endpoint.

### Evidence Engine

- Evidence feed with district enrichment and pagination: no endpoint.
- Evidence summary counts and source metadata: no endpoint; `sourceMeta` not stored.
- Scan steps: no scan table and no step status source.
- Scan SSE events: not implemented.

### Workflow

- Peer network edges with weights/reasons: no source.
- Peer comparison metrics: partially computable, no endpoint.
- Intervention tracker rows and summary: no table/source.
- Tracker SSE: not implemented.
- Alerts and alert lifecycle: no table/source.

### AI Analyst

- AI insight cards: no source, table, or generation pipeline.
- Chat conversations/messages: no source or endpoint.
- AI chat token stream: not implemented.

### Map

- Backend-owned GeoJSON: no file, table, scraper, or endpoint.
- Contract notes frontend can fetch third-party GeoJSON directly via env, but backend has no source for `/api/map/india/states.geojson`.

## Data That Exists But Has No Contract Endpoint Yet

| Existing data/process | Where it lives | Current endpoint | Gap |
|---|---|---|---|
| Raw classifier service | `scrapers/classifier.py` | `POST /evidence/classify` | Not in `API_CONTRACT.md`; useful as internal admin/dev endpoint only. |
| Celery job result metadata | Redis Celery backend | `GET /analyze/{job_id}` | Contract expects scan ids/status/steps/found evidence, not generic Celery state. |
| Evidence `embedding vector(384)` column | `evidence.embedding` | None | No embedding generation, search, or vector endpoint. |
| Raw HTML from scrapers before classification | In memory only during Celery job | None | Not persisted, so no audit/debug endpoint. |
| Numeric cluster ids | `cluster_assignments.cluster_id` | `/cluster/{cluster_id}/...` | Contract uses string `ClusterId`. |
| `census_code` | `districts.census_code` | `/districts`, `/districts/{id}` | Seed does not populate it; contract does not include it. |

## File Coverage Notes

- `backend/main.py`: app startup schema init, CORS, route mounting, health endpoint.
- `backend/config.py`: environment variable definitions only.
- `backend/db/session.py`: asyncpg pool and JSON/JSONB codecs; executes schema at startup.
- `backend/db/schema.sql`: full database schema; no migrations directory exists.
- `backend/models/schemas.py`: active Pydantic schemas used by routers.
- `backend/schemas.py`: duplicate/older Pydantic schema module; not imported by current routers.
- `backend/seed.py`: main demo data source and destructive seed ETL.
- `backend/routers/*.py`: all implemented API reads/writes and trigger points.
- `backend/tasks/scrape_jobs.py`: Celery ingestion pipeline.
- `backend/ml/features.py`: feature matrix loader.
- `backend/ml/train.py`: offline cluster/SHAP writer.
- `scrapers/*.py`: Bright Data and Gemini integrations.
- `backend/README.md`: documents operational commands; contains stale Anthropic key reference.
- `docker-compose.yml`: Postgres/pgvector and Redis infrastructure.

## Recommended Next Steps

1. Add source-of-truth tables for alerts, tracker items, pipeline telemetry, scan runs/steps, source metadata, cluster metadata, model runs, embeddings/projections, and AI chat/insights.
2. Add a real district/features importer for ASER and other official datasets; keep `seed.py` as demo/test data only.
3. Persist scan runs and raw scrape artifacts before classification so evidence can be audited and scan progress can be streamed.
4. Normalize source types to the frontend contract or expand the contract to include `govt_press_release` and `grievance_portal`.
5. Add DTO mapping layers so DB fields map cleanly to contract fields (`raw_text` to `raw`, `source_url` to `url`, feature JSON to `reading3`, etc.).
6. Version ML outputs with `modelVersion`, `trainedAt`, metrics, and saved projection points.
7. Implement contract endpoints in priority order: overview/app shell, district detail, evidence/scans, clusters, workflow, analytics, pipeline, AI.
