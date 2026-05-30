# Backend Compatibility Audit

Audited against `backend/API_CONTRACT.md` and `frontend/API_CONTRACT.md` on 2026-05-30. The two contract files contain the same frontend-derived API contract. The implemented backend is a FastAPI service mounted at bare paths such as `/districts`, `/cluster`, `/evidence`, and `/analyze`, while the contract expects `/api/...`.

## Summary

| Endpoint / stream | Status |
|---|---|
| GET `/api/me` | ❌ MISSING |
| GET `/api/navigation/summary` | ❌ MISSING |
| GET `/api/search` | ❌ MISSING |
| GET `/api/pipeline/status` | ❌ MISSING |
| GET `/api/bootstrap` | ❌ MISSING |
| GET `/api/overview` | ❌ MISSING |
| GET `/api/districts/map` | ❌ MISSING |
| GET `/api/districts/leaderboard` | ❌ MISSING |
| GET `/api/districts/{districtId}` | ⚠️ PARTIAL |
| GET `/api/districts/{districtId}/evidence` | ⚠️ PARTIAL |
| GET `/api/districts/{districtId}/features` | ⚠️ PARTIAL |
| GET `/api/districts/{districtId}/peers` | ⚠️ PARTIAL |
| GET `/api/districts/{districtId}/interventions` | ❌ MISSING |
| POST `/api/districts/{districtId}/scan` | ⚠️ PARTIAL |
| GET `/api/clusters` | ❌ MISSING |
| GET `/api/clusters/{clusterId}` | ❌ MISSING |
| GET `/api/clusters/{clusterId}/districts` | ⚠️ PARTIAL |
| GET `/api/clusters/{clusterId}/interventions` | ⚠️ PARTIAL |
| GET `/api/evidence` | ❌ MISSING |
| GET `/api/evidence/summary` | ❌ MISSING |
| POST `/api/scans` | ⚠️ PARTIAL |
| GET `/api/scans/{scanId}` | ⚠️ PARTIAL |
| GET `/api/analytics/summary` | ❌ MISSING |
| GET `/api/analytics/embedding` | ❌ MISSING |
| GET `/api/analytics/shap` | ❌ MISSING |
| GET `/api/analytics/cause-prevalence` | ❌ MISSING |
| GET `/api/analytics/histogram` | ❌ MISSING |
| GET `/api/analytics/correlation` | ❌ MISSING |
| GET `/api/districts/{districtId}/radar` | ❌ MISSING |
| GET `/api/pipeline/overview` | ❌ MISSING |
| GET `/api/pipeline/sources` | ❌ MISSING |
| GET `/api/pipeline/stages` | ❌ MISSING |
| GET `/api/peers` | ❌ MISSING |
| GET `/api/peer-network` | ❌ MISSING |
| GET `/api/districts/{districtId}/comparison` | ❌ MISSING |
| GET `/api/intervention-tracker` | ❌ MISSING |
| POST `/api/intervention-tracker` | ❌ MISSING |
| PATCH `/api/intervention-tracker/{trackerId}` | ❌ MISSING |
| GET `/api/alerts` | ❌ MISSING |
| PATCH `/api/alerts/{alertId}` | ❌ MISSING |
| GET `/api/ai/insights` | ❌ MISSING |
| POST `/api/ai/chat` | ❌ MISSING |
| GET `/api/map/india/states.geojson` | ❌ MISSING |
| GET `/api/stream/app-summary` | ❌ MISSING |
| GET `/api/stream/overview` | ❌ MISSING |
| GET `/api/stream/pipeline` | ❌ MISSING |
| GET `/api/stream/scans/{scanId}` | ❌ MISSING |
| GET `/api/stream/model-status` | ❌ MISSING |
| GET `/api/stream/intervention-tracker` | ❌ MISSING |
| GET `/api/stream/alerts` | ❌ MISSING |
| GET `/api/stream/ai/chat/{messageId}` | ❌ MISSING |

## Global Findings

- **Base path mismatch:** Contract expects all HTTP and SSE endpoints under `/api`. Backend mounts routers at `/districts`, `/cluster`, `/evidence`, and `/analyze` in `backend/main.py:32-35`.
- **No auth enforcement:** No route imports or uses `Depends`, `Security`, bearer-token validation, session middleware, or authorization checks. CORS allows all origins, methods, and headers in `backend/main.py:25-30`.
- **No realtime implementation:** No `StreamingResponse`, `EventSourceResponse`, `text/event-stream`, `WebSocket`, or `@app.websocket` implementation exists.
- **Shape mismatch pattern:** Backend schemas use database-shaped fields (`census_code`, `cluster_label`, `raw_text`, `source_url`, `scraped_at`, UUID ids), while frontend contract expects UI/domain-shaped fields (`stateCode`, `cluster`, `raw`, `url`, `date`, string ids, richer metric fields).
- **Cluster id mismatch:** Contract `ClusterId` is a string union including `pedagogical`, while backend README documents numeric cluster ids and uses `pedagogical_failure` for one label.

## Implemented Backend Routes

| Method | Backend path | Definition | In contract? | Notes |
|---|---|---|---|---|
| GET | `/health` | `backend/main.py:38` | No | Extra health route. |
| GET | `/districts` | `backend/routers/districts.py:8`, mounted `backend/main.py:32` | No exact match | Similar to map/search/bootstrap district lists, but path and shape differ. |
| GET | `/districts/{district_id}` | `backend/routers/districts.py:22`, mounted `backend/main.py:32` | Partial | Similar to `/api/districts/{districtId}`. Missing `/api` prefix and response fields. |
| GET | `/cluster/{cluster_id}/peers` | `backend/routers/clusters.py:8`, mounted `backend/main.py:33` | No exact match | Similar to cluster districts/peers, but contract expects `/api/clusters/{clusterId}/districts`. |
| GET | `/cluster/{cluster_id}/interventions` | `backend/routers/clusters.py:26`, mounted `backend/main.py:33` | Partial | Similar to `/api/clusters/{clusterId}/interventions`, but singular path and shape differ. |
| POST | `/analyze` | `backend/routers/analyze.py:9`, mounted `backend/main.py:35` | Partial | Similar to scan creation, but contract expects `/api/scans` and/or `/api/districts/{districtId}/scan`. |
| GET | `/analyze/{job_id}` | `backend/routers/analyze.py:23`, mounted `backend/main.py:35` | Partial | Similar to `/api/scans/{scanId}`. |
| POST | `/evidence/classify` | `backend/routers/evidence.py:7`, mounted `backend/main.py:34` | No | Extra internal classification route. |

## Detailed Endpoint Findings

### Cross-App Shell

#### GET `/api/me`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `GET /api/me`.
- Request shape: No request body expected.
- Response shape: Missing `MeResponse` with `id`, `name`, `initials`, `role`.
- Auth: Contract defines frontend token storage, but no explicit endpoint auth rule. Backend has no auth middleware.
- Dependent views: App shell user identity.

#### GET `/api/navigation/summary`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `GET /api/navigation/summary`.
- Request shape: No request body expected.
- Response shape: Missing `highAlertCount`, `clusterCounts`, and `pipeline`.
- Auth: No backend auth.
- Dependent views: App shell alert badge, cluster counts, pipeline status.

#### GET `/api/search`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected query params `q` and `types`.
- Request shape: Backend has no server-side search.
- Response shape: Missing `query`, `districts`, `clusters`, and `views`.
- Auth: No backend auth.
- Dependent views: Command palette.

#### GET `/api/pipeline/status`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Request/response shape: Contract mentions status for app shell but does not define a standalone response interface beyond `NavigationSummaryResponse.pipeline`.
- Auth: No backend auth.
- Dependent views: Topbar status.

#### GET `/api/stream/app-summary`
- Existence: **NO - MISSING**.
- Realtime check: No SSE endpoint; no `AppSummaryEvent` emission for `alert_count`, `pipeline_status`, or `cluster_counts`.
- Auth: No backend auth.
- Dependent views: App shell live badge/status updates.

### Bootstrap / Data Module

#### GET `/api/bootstrap`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Request shape: No request body expected.
- Response shape: Missing `BootstrapResponse` with clusters, feature labels, districts, interventions, tracker, alerts, scan steps, source metadata, and cluster order.
- Auth: No backend auth.
- Dependent views: Optional app-wide mock replacement.

### Overview

#### GET `/api/overview`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected optional `year`.
- Request shape: `year` is not accepted anywhere.
- Response shape: Missing `OverviewResponse` totals, cluster counts, and cluster dictionary.
- Auth: No backend auth.
- Dependent views: Overview KPI cards and distribution.

#### GET `/api/districts/map`
- Existence: **NO - MISSING**.
- Method/path: No exact route. Backend has `GET /districts` at `backend/routers/districts.py:8`, but not `/api/districts/map`.
- Request shape: Contract accepts `year` and optional `cluster`; backend list accepts neither.
- Response shape: Contract expects `{ districts, states, geoJson? }`; backend returns a bare list of `DistrictListItem` with `id`, `name`, `state`, `census_code`, `lat`, `lng`, `cluster_label`, `confidence`.
- Auth: No backend auth.
- Dependent views: Overview map, Map component.

#### GET `/api/districts/leaderboard`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Request shape: Missing `metric`, `order`, `limit`, and `year`.
- Response shape: Missing `{ items: LeaderboardDistrict[] }`.
- Auth: No backend auth.
- Dependent views: Overview lowest-performing leaderboard.

#### GET `/api/stream/overview`
- Existence: **NO - MISSING**.
- Realtime check: No SSE stream for KPI/evidence count updates.
- Auth: No backend auth.
- Dependent views: Overview live KPI updates.

### District Detail

#### GET `/api/districts/{districtId}`
- Existence: **PARTIAL**. Similar backend route exists at `backend/routers/districts.py:22`, mounted as `GET /districts/{district_id}` by `backend/main.py:32`.
- Method/path: Method matches `GET`; path does not match because `/api` prefix is missing and param name differs from contract.
- Request shape: Accepts path `district_id: str`. Contract expects `districtId` path string. No query params.
- Response shape: Backend returns `DistrictDetail` (`backend/models/schemas.py:56`) with `district`, nullable `cluster`, nullable `features`, `evidence`, `peers`. It is missing contract fields `interventions`, rich `features` array, frontend `Cluster` object, peer `cluster` and `reading3`, and many `District` fields (`stateCode`, `cluster`, `reading3`, `arith5`, `trend`, `shap`, etc.). Backend evidence field names differ: `raw_text` vs `raw`, `source_url` vs `url`, `scraped_at` vs `date`, UUID ids vs strings.
- Auth: No backend auth.
- Dependent views: District detail, many cross-view navigations.

#### GET `/api/districts/{districtId}/evidence`
- Existence: **PARTIAL**. Evidence is loaded inside `GET /districts/{district_id}` at `backend/routers/districts.py:41-44`, but no standalone route exists.
- Method/path: Expected standalone `GET /api/districts/{districtId}/evidence`; backend only embeds evidence in `GET /districts/{district_id}`.
- Request shape: Expected path `districtId`; backend embedded query uses `district_id`.
- Response shape: Contract expects `EvidenceItem[]`; backend returns `Evidence[]` with `raw_text`, `source_url`, `scraped_at`, UUID fields.
- Auth: No backend auth.
- Dependent views: District evidence section.

#### GET `/api/districts/{districtId}/features`
- Existence: **PARTIAL**. Latest features are loaded inside `GET /districts/{district_id}` at `backend/routers/districts.py:36-39`, but no standalone route exists.
- Method/path: Expected standalone `GET /api/districts/{districtId}/features`.
- Request shape: Expected path `districtId`.
- Response shape: Contract expects feature rows like `{ key, label, value, unit? }`; backend returns `DistrictFeatures` with `district_id`, `year`, and raw `features` JSON.
- Auth: No backend auth.
- Dependent views: District feature table.

#### GET `/api/districts/{districtId}/peers`
- Existence: **PARTIAL**. Peers are loaded inside `GET /districts/{district_id}` at `backend/routers/districts.py:46-58`, but no standalone route exists.
- Method/path: Expected standalone `GET /api/districts/{districtId}/peers`.
- Request shape: Expected path `districtId`.
- Response shape: Contract expects peers with `id`, `name`, `state`, `cluster`, `reading3`; backend returns bare `District` rows with no cluster or reading metrics.
- Auth: No backend auth.
- Dependent views: District peer chips.

#### GET `/api/districts/{districtId}/interventions`
- Existence: **NO - MISSING**.
- Method/path: No district intervention route. Backend only has `GET /cluster/{cluster_id}/interventions` at `backend/routers/clusters.py:26`.
- Request shape: Expected path `districtId`.
- Response shape: Missing `Intervention[]` with `cluster`, `type`, `districts`, `aserDelta`, `evidence`, `blurb`.
- Auth: No backend auth.
- Dependent views: District intervention recommendations.

#### POST `/api/districts/{districtId}/scan`
- Existence: **PARTIAL**. Similar functionality exists as `POST /analyze` at `backend/routers/analyze.py:9`, mounted by `backend/main.py:35`.
- Method/path: Method matches `POST`; path does not. Backend takes district in body rather than path.
- Request shape: Contract expects optional body `{ sources?, priority? }` plus path `districtId`; backend expects body `{ district_id: string }` via `AnalyzeRequest` at `backend/models/schemas.py:69`.
- Response shape: Contract expects `scanId`, `districtId`, `status: "queued" | "running"`, `streamUrl`; backend returns `job_id` and `status`.
- Auth: No backend auth.
- Realtime check: Contract pairs this with `GET /api/stream/scans/{scanId}`; backend only provides polling.
- Dependent views: District "Run live scan".

### Evidence Engine

#### GET `/api/evidence`
- Existence: **NO - MISSING**.
- Method/path: No backend feed route.
- Request shape: Missing filters `districtId`, `classification`, `sourceType`, `limit`, `cursor`.
- Response shape: Missing `{ items, nextCursor? }` with enriched `districtName`, `districtState`, `cluster`.
- Auth: No backend auth.
- Dependent views: Evidence feed.

#### GET `/api/evidence/summary`
- Existence: **NO - MISSING**.
- Method/path: No backend summary route.
- Request shape: No request body expected.
- Response shape: Missing `classificationCounts`, `sourceCounts`, and `sourceMeta`.
- Auth: No backend auth.
- Dependent views: Evidence count cards and filters.

#### POST `/api/scans`
- Existence: **PARTIAL**. Similar backend route exists as `POST /analyze` at `backend/routers/analyze.py:9`.
- Method/path: Method matches `POST`; path differs.
- Request shape: Contract expects `{ districtId, sources? }`; backend expects `{ district_id }`.
- Response shape: Contract expects scan status with `scanId`; backend returns Celery `job_id`.
- Auth: No backend auth.
- Realtime check: No scan SSE.
- Dependent views: Evidence live scan.

#### GET `/api/scans/{scanId}`
- Existence: **PARTIAL**. Similar backend route exists as `GET /analyze/{job_id}` at `backend/routers/analyze.py:23`.
- Method/path: Method matches `GET`; path differs.
- Request shape: Contract expects path `scanId`; backend uses `job_id`.
- Response shape: Contract expects `scanId`, `districtId`, `status`, `steps`, `found`; backend returns `job_id`, `status`, optional `result` or `error`. No step list or found evidence list guaranteed.
- Auth: No backend auth.
- Dependent views: Evidence scan results/status.

#### GET `/api/stream/scans/{scanId}`
- Existence: **NO - MISSING**.
- Realtime check: No SSE endpoint; no `ScanEvent` emissions for `step`, `evidence`, `complete`, or `error`.
- Auth: No backend auth.
- Dependent views: Evidence live scan console and District scan progress.

### Cause Clusters

#### GET `/api/clusters`
- Existence: **NO - MISSING**.
- Method/path: No backend list route.
- Request shape: No request body expected.
- Response shape: Missing `{ items: ClusterCardSummary[] }`.
- Auth: No backend auth.
- Dependent views: Cause Clusters cards.

#### GET `/api/clusters/{clusterId}`
- Existence: **NO - MISSING**.
- Method/path: No cluster detail route.
- Request shape: Expected path string-union cluster id.
- Response shape: Missing cluster detail/card summary.
- Auth: No backend auth.
- Dependent views: Potential cluster drilldown.

#### GET `/api/clusters/{clusterId}/districts`
- Existence: **PARTIAL**. Similar backend route exists as `GET /cluster/{cluster_id}/peers` at `backend/routers/clusters.py:8`.
- Method/path: Method matches `GET`; path differs (`/cluster` singular, `/peers` suffix) and no `/api`.
- Request shape: Contract expects string `clusterId`; backend expects integer `cluster_id`.
- Response shape: Contract expects district chips including at least `id`, `name`, `reading3`, `cluster`; backend returns bare `District` with no reading score or cluster string.
- Auth: No backend auth.
- Dependent views: Cause cluster district chips.

#### GET `/api/clusters/{clusterId}/interventions`
- Existence: **PARTIAL**. Backend route exists as `GET /cluster/{cluster_id}/interventions` at `backend/routers/clusters.py:26`.
- Method/path: Method matches `GET`; path differs (`/cluster` singular, missing `/api`) and backend does not declare contract query params `sort` and `limit`.
- Request shape: Contract expects string `clusterId` and optional `sort`, `limit`; backend expects integer `cluster_id`.
- Response shape: Contract expects frontend `Intervention` fields `cluster`, `type`, `districts`, `aserDelta`, `evidence`, `blurb`; backend returns DB intervention fields `id`, `district_id`, `intervention_type`, `started_at`, `aser_delta`, `notes`.
- Auth: No backend auth.
- Dependent views: Cause Clusters best intervention.

### Analytics / Signal Lab

#### GET `/api/analytics/summary`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected optional `year`.
- Response shape: Missing `AnalyticsSummaryResponse`.
- Auth: No backend auth.
- Dependent views: Signal Lab header metrics.

#### GET `/api/analytics/embedding`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `modelVersion`.
- Response shape: Missing embedding projection and points.
- Auth: No backend auth.
- Dependent views: Embedding chart.

#### GET `/api/analytics/shap`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `modelVersion`.
- Response shape: Missing SHAP rows. Backend stores `shap_values` in cluster assignments but does not expose the contract shape.
- Auth: No backend auth.
- Dependent views: SHAP beeswarm/waterfall data.

#### GET `/api/analytics/cause-prevalence`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `from` and `to`.
- Response shape: Missing yearly cluster prevalence rows.
- Auth: No backend auth.
- Dependent views: Cause prevalence stream.

#### GET `/api/analytics/histogram`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `metric` and `bins`.
- Response shape: Missing histogram bins by cluster.
- Auth: No backend auth.
- Dependent views: Reading score histogram.

#### GET `/api/analytics/correlation`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `features`.
- Response shape: Missing features and correlation matrix.
- Auth: No backend auth.
- Dependent views: Correlation heatmap.

#### GET `/api/districts/{districtId}/radar`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected optional `modelVersion`.
- Response shape: Missing radar axes and series.
- Auth: No backend auth.
- Dependent views: Signal Lab feature radar.

#### GET `/api/stream/model-status`
- Existence: **NO - MISSING**.
- Realtime check: No SSE for model retrain/artifact status.
- Auth: No backend auth.
- Dependent views: Signal Lab model status.

### Pipeline

#### GET `/api/pipeline/overview`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Response shape: Missing `PipelineOverviewResponse`.
- Auth: No backend auth.
- Dependent views: Pipeline dashboard.

#### GET `/api/pipeline/sources`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Response shape: Missing `PipelineSource[]`.
- Auth: No backend auth.
- Dependent views: Pipeline source list.

#### GET `/api/pipeline/stages`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Response shape: Missing `PipelineStage[]`.
- Auth: No backend auth.
- Dependent views: Pipeline stages.

#### GET `/api/stream/pipeline`
- Existence: **NO - MISSING**.
- Realtime check: No SSE endpoint; no `PipelineEvent` emissions for `throughput`, `source_status`, `stage_status`, or `overview`.
- Auth: No backend auth.
- Dependent views: Pipeline live telemetry.

### Peers & Interventions

#### GET `/api/peers`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `anchorId`.
- Response shape: Contract does not define a separate response shape here, but view needs anchor peer data.
- Auth: No backend auth.
- Dependent views: Workflow peers/interventions.

#### GET `/api/peer-network`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected optional `anchorId`.
- Response shape: Missing `PeerNetworkResponse` with nodes and edges.
- Auth: No backend auth.
- Dependent views: Peer network graph.

#### GET `/api/districts/{districtId}/comparison`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `peerIds`.
- Response shape: Missing `PeerComparisonResponse`.
- Auth: No backend auth.
- Dependent views: Peer metrics table and transferable interventions.

### Intervention Tracker

#### GET `/api/intervention-tracker`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Response shape: Missing tracker `summary` and enriched `items`.
- Auth: No backend auth.
- Dependent views: Intervention Tracker.

#### POST `/api/intervention-tracker`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Request shape: Missing `UpsertTrackerRequest`.
- Response shape: Not implemented.
- Auth: No backend auth.
- Dependent views: Future tracker creation.

#### PATCH `/api/intervention-tracker/{trackerId}`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Request shape: Missing partial update handling for tracker fields.
- Response shape: Not implemented.
- Auth: No backend auth.
- Dependent views: Future tracker status updates.

#### GET `/api/stream/intervention-tracker`
- Existence: **NO - MISSING**.
- Realtime check: No SSE for tracker progress updates.
- Auth: No backend auth.
- Dependent views: Tracker live progress.

### Alerts

#### GET `/api/alerts`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `level`, `status`, `limit`.
- Response shape: Missing `{ items: Alert[] }`.
- Auth: No backend auth.
- Dependent views: Alerts list and app badge.

#### PATCH `/api/alerts/{alertId}`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Request shape: Missing `UpdateAlertRequest`.
- Response shape: Not implemented.
- Auth: No backend auth.
- Dependent views: Alert acknowledge/resolve/viewed lifecycle.

#### GET `/api/stream/alerts`
- Existence: **NO - MISSING**.
- Realtime check: No SSE endpoint; no `AlertEvent` emissions for `created`, `updated`, or `deleted`.
- Auth: No backend auth.
- Dependent views: Alerts and app badge.

### AI Analyst

#### GET `/api/ai/insights`
- Existence: **NO - MISSING**.
- Method/path: No backend route. Expected `districtId` and `limit`.
- Response shape: Missing `{ items: AIInsight[] }`.
- Auth: No backend auth.
- Dependent views: AI Analyst insight cards.

#### POST `/api/ai/chat`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Request shape: Missing `AIChatRequest` with `message`, optional `districtId`, optional `conversationId`.
- Response shape: Missing `AIChatResponse`.
- Auth: No backend auth.
- Dependent views: AI Analyst chat.

#### GET `/api/stream/ai/chat/{messageId}`
- Existence: **NO - MISSING**.
- Realtime check: No SSE endpoint; no `AIChatEvent` emissions for `token`, `sources`, `done`, or `error`.
- Auth: No backend auth.
- Dependent views: Streaming AI chat.

### Map

#### GET `/api/map/india/states.geojson`
- Existence: **NO - MISSING**.
- Method/path: No backend route.
- Request shape: No request body expected.
- Response shape: Missing GeoJSON `FeatureCollection`.
- Auth: No backend auth.
- Dependent views: Optional backend-owned map geometry.

## Extra Backend Routes Not In Contract

| Method | Path | Definition | Notes |
|---|---|---|---|
| GET | `/health` | `backend/main.py:38` | Useful operational health check but undocumented in contract. |
| GET | `/districts` | `backend/routers/districts.py:8` | Bare district list, no `/api` prefix, not listed in contract summary. Could back search/bootstrap/map after shape changes. |
| GET | `/cluster/{cluster_id}/peers` | `backend/routers/clusters.py:8` | Similar to cluster districts but path and semantics differ. |
| POST | `/analyze` | `backend/routers/analyze.py:9` | Similar to scan creation but path/body/response differ. |
| GET | `/analyze/{job_id}` | `backend/routers/analyze.py:23` | Similar to scan polling but path/response differ. |
| POST | `/evidence/classify` | `backend/routers/evidence.py:7` | Internal classifier endpoint, not listed in frontend contract. |

## Missing Features Prioritized By Views

1. **App shell and overview blockers:** `/api/me`, `/api/navigation/summary`, `/api/search`, `/api/overview`, `/api/districts/map`, `/api/districts/leaderboard`, `/api/stream/app-summary`, `/api/stream/overview`.
2. **District detail blockers:** Fix `/api/districts/{districtId}` response shape, then add separate evidence/features/peers/interventions endpoints.
3. **Evidence scan blockers:** Replace or wrap `/analyze` as `/api/scans` and `/api/districts/{districtId}/scan`; add `/api/scans/{scanId}` shape and `/api/stream/scans/{scanId}` SSE.
4. **Cluster view blockers:** Add `/api/clusters`, `/api/clusters/{clusterId}`, `/api/clusters/{clusterId}/districts`; fix interventions route path, id type, query params, and response shape.
5. **Workflow blockers:** Add peer network, peer comparison, intervention tracker, alerts, and related SSE streams.
6. **Analytics blockers:** Add summary, embedding, SHAP, prevalence, histogram, correlation, radar, and model-status stream.
7. **Pipeline blockers:** Add pipeline overview/sources/stages plus pipeline telemetry SSE.
8. **AI blockers:** Add AI insights, chat request endpoint, and chat streaming SSE.
9. **Map geometry:** Add `/api/map/india/states.geojson` only if backend should own geometry rather than using configured third-party GeoJSON URLs.

## Next Steps

1. Add an `/api` prefix, either globally or per router, while preserving old paths only if needed for backward compatibility.
2. Create response DTOs that match the frontend contract exactly; avoid leaking DB field names like `raw_text`, `source_url`, `scraped_at`, `census_code`, and `cluster_label`.
3. Normalize ids and cluster labels to the contract: string ids in JSON, string-union `ClusterId`, `stateCode`, `cluster`, `reading3`, `arith5`, trend, SHAP, and evidence fields.
4. Build the first high-impact REST group: app shell, overview, district detail, evidence feed/summary, scan create/status.
5. Implement SSE infrastructure for scans first, then app summary, overview, pipeline, alerts, tracker, model status, and AI chat.
6. Decide auth policy. If the frontend will send `Authorization: Bearer <token>` from `VITE_AUTH_TOKEN_KEY`, add a FastAPI dependency and document which public endpoints are exempt.
7. Add contract tests that call every endpoint in this file and assert method, path, auth behavior, request validation, and response JSON shape.
