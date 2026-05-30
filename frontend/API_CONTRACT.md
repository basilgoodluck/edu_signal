# EduSignal Frontend Backend API Contract

This document is inferred from the current React app. There are no backend calls yet; nearly all displayed domain data currently comes from `src/data/data.js` or component-local mock constants. Every domain data source below is flagged `NEEDS REAL ENDPOINT`.

## Environment

The frontend reads environment variables only through `src/config.js`.

```ts
interface FrontendConfig {
  api: {
    baseUrl: string | undefined;
    wsUrl: string | undefined;
    timeout: number;
  };
  map: {
    tileUrl: string | undefined;
    apiKey: string | undefined;
    geoJsonUrls: string[];
  };
  auth: {
    tokenKey: string;
  };
}
```

Required `.env` variables:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_API_TIMEOUT=10000
VITE_MAP_TILE_URL=
VITE_MAP_API_KEY=
VITE_MAP_GEOJSON_URLS=https://cdn.jsdelivr.net/gh/adarshbiradar/maps-geojson@master/india.json,https://cdn.jsdelivr.net/gh/geohacker/india@master/state/india_state.geojson,https://cdn.jsdelivr.net/gh/Subhash9325/GeoJson-Data-of-Indian-States@master/Indian_States
VITE_AUTH_TOKEN_KEY=auth_token
```

## Shared Types

```ts
type ClusterId =
  | "seasonal_migration"
  | "language_barrier"
  | "teacher_shortage"
  | "infrastructure"
  | "pedagogical"
  | "noise";

type EvidenceClassification = "Supporting" | "Contradicting" | "Irrelevant";
type EvidenceSourceType = "news" | "satellite" | "vacancy_portal" | "forum" | "ngo_report";
type AlertLevel = "high" | "medium" | "low";
type TrackerStatus = "active" | "monitoring" | "complete";

interface Cluster {
  id: ClusterId;
  label: string;
  short: string;
  color: string;
  tint: string;
  blurb: string;
  window: string;
  signature: string[];
}

interface DistrictTrendPoint {
  year: number;
  reading3: number;
  arith5: number;
}

interface ShapContribution {
  feature: string;
  contribution: number;
}

interface EvidenceItem {
  id: string;
  districtId: string;
  raw: string;
  source: string;
  sourceType: EvidenceSourceType;
  date: string;
  classification: EvidenceClassification;
  reason: string;
  url: string;
}

interface District {
  id: string;
  name: string;
  state: string;
  stateCode: string;
  lat: number;
  lng: number;
  cluster: ClusterId;
  confidence: number;
  featured?: boolean;
  reading3: number;
  arith5: number;
  yoyReading: number;
  genderGap: number;
  ptr: number;
  vacancyRate: number;
  infraScore: number;
  ndviVar: number;
  floodDays: number;
  roadIdx: number;
  vacancyPosts: number;
  newsMigration: number;
  newsFlood: number;
  forumComplaints: number;
  shap: ShapContribution[];
  trend: DistrictTrendPoint[];
  peers: string[];
  evidence: EvidenceItem[];
}

interface Intervention {
  id?: string;
  cluster: ClusterId;
  type: string;
  districts: string[];
  aserDelta: number;
  evidence: number;
  blurb: string;
}

interface TrackerItem {
  id: string;
  district: string;
  type: string;
  started: string;
  status: TrackerStatus;
  baseline: number;
  latest: number;
  target: number;
  note: string;
}

interface Alert {
  id: string;
  level: AlertLevel;
  district: string;
  title: string;
  body: string;
  when: string;
  cluster: ClusterId;
}

interface SourceMeta {
  label: string;
  icon: string;
}

interface ScanStep {
  index: number;
  label: string;
  source: string;
  status: "wait" | "run" | "done" | "error";
}
```

## Cross-App Shell - `src/App.jsx`

### Data Displayed

- Sidebar navigation labels, icons, route active state. Current source: local `NAV` constant. `NEEDS REAL ENDPOINT` only if navigation becomes role or feature-flag driven.
- Alert badge count for high alerts. Current source: `D.ALERTS`. `NEEDS REAL ENDPOINT`.
- Cause cluster counts and labels. Current source: `D.DISTRICTS`, `D.CLUSTERS`, `D.CLUSTER_ORDER`. `NEEDS REAL ENDPOINT`.
- User identity: `R. Kulkarni`, `District Education Officer`, initials. Current source: hardcoded. `NEEDS REAL ENDPOINT`.
- Topbar current route label and pipeline status text. Current source: local route state and hardcoded status. Pipeline status `NEEDS REAL ENDPOINT`.
- Command palette district, state, cluster labels and matching views. Current source: `D.DISTRICTS`, `D.CLUSTERS`, local `NAV`. District search `NEEDS REAL ENDPOINT`.

### Actions

- Navigate to view. Backend trigger: none.
- Select district from command palette. Backend trigger: fetch district detail if not already cached.
- Search command palette. Backend trigger: optional server-side search when dataset grows.
- Open/close command palette. Backend trigger: none.

### Recommended API

Static app chrome can be bundled, but counts, identity, and live status should come from REST plus optional SSE for status changes.

```http
GET /api/me
GET /api/navigation/summary
GET /api/search?q={query}&types=district,view,cluster
GET /api/pipeline/status
GET /api/stream/app-summary
```

Use REST GET for identity and initial summaries. Use SSE for low-frequency badge/status updates; WebSocket is unnecessary unless the app later supports collaborative state.

```ts
interface MeResponse {
  id: string;
  name: string;
  initials: string;
  role: string;
}

interface NavigationSummaryResponse {
  highAlertCount: number;
  clusterCounts: Record<ClusterId, number>;
  pipeline: {
    status: "live" | "degraded" | "offline";
    label: string;
    sourcesLabel: string;
  };
}

interface SearchResponse {
  query: string;
  districts: Array<Pick<District, "id" | "name" | "state" | "cluster">>;
  clusters: Cluster[];
  views: Array<{ id: string; label: string; path: string; icon: string }>;
}

type AppSummaryEvent =
  | { type: "alert_count"; highAlertCount: number }
  | { type: "pipeline_status"; pipeline: NavigationSummaryResponse["pipeline"] }
  | { type: "cluster_counts"; clusterCounts: Record<ClusterId, number> };
```

## Overview - `src/views/OverviewView.jsx`

### Data Displayed

- Page title, subtitle, year label. Current source: hardcoded props/text. Static unless CMS controlled.
- KPI cards: district count, average grade-3 reading, declining YoY count, dominant cause, live evidence count. Current source: derived from `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.
- Cause map: district coordinates, state, cluster, confidence, reading score, YoY, featured marker, state-level dominant cluster and average reading. Current source: `D.DISTRICTS`, `Map.jsx` fallback GeoJSON. `NEEDS REAL ENDPOINT`.
- Cause legend and distribution bar: cluster labels, counts, percentages. Current source: `D.CLUSTERS`, derived counts. `NEEDS REAL ENDPOINT`.
- Lowest performing leaderboard: district name, state, cluster, reading score, YoY, trend sparkline. Current source: sorted `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.

### Actions

- Run live scan button navigates to Evidence Engine. Backend trigger should start a scan only after user selects target and confirms in Evidence view.
- Toggle cluster filter on legend/distribution. Backend trigger: none for small dataset; for real scale use query params and server filtering.
- Select district from map or leaderboard. Backend trigger: fetch district detail.
- Explore cause distribution navigates to clusters. Backend trigger: none.

### Recommended API

Use REST GET for dashboard summary and map data. Use SSE for live KPI/evidence count if updated by ingestion.

```http
GET /api/overview?year=2023
GET /api/districts/map?year=2023&cluster={clusterId?}
GET /api/districts/leaderboard?metric=reading3&order=asc&limit=8&year=2023
GET /api/stream/overview?year=2023
```

```ts
interface OverviewResponse {
  year: string;
  totals: {
    districtsAnalyzed: number;
    statesCovered: number;
    avgReading3: number;
    decliningYoyCount: number;
    dominantCluster: ClusterId;
    dominantClusterLabel: string;
    dominantClusterDistricts: number;
    liveEvidenceCount: number;
  };
  clusterCounts: Record<ClusterId, number>;
  clusters: Record<ClusterId, Cluster>;
}

interface DistrictMapPoint {
  id: string;
  name: string;
  state: string;
  stateCode: string;
  lat: number;
  lng: number;
  cluster: ClusterId;
  confidence: number;
  reading3: number;
  yoyReading: number;
  featured?: boolean;
  peers: string[];
}

interface StateMapSummary {
  stateCode: string;
  stateName: string;
  dominant: ClusterId;
  total: number;
  avgReading: number;
}

interface DistrictMapResponse {
  districts: DistrictMapPoint[];
  states: StateMapSummary[];
  geoJson?: GeoJSON.FeatureCollection;
}

interface LeaderboardDistrict {
  id: string;
  name: string;
  stateCode: string;
  cluster: ClusterId;
  reading3: number;
  yoyReading: number;
  trend: DistrictTrendPoint[];
}

interface LeaderboardResponse {
  items: LeaderboardDistrict[];
}
```

## Signal Lab - `src/views/AnalyticsView.jsx`

### Data Displayed

- Silhouette score, clustered/total count, noise count. Current source: hardcoded `0.61` and derived `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.
- District embedding chart: projected coordinates, cluster hulls, active cluster filter, district severity. Current source: generated client-side from `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.
- SHAP beeswarm: per-feature contribution distribution. Current source: `D.DISTRICTS[].shap`. `NEEDS REAL ENDPOINT`.
- Cause prevalence stream over years. Current source: client-generated mock from cluster counts. `NEEDS REAL ENDPOINT`.
- Reading score histogram stacked by cluster. Current source: `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.
- Correlation heatmap over features. Current source: client-computed from `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.
- Feature radar for selected district. Current source: `D.byId`, computed normalized metrics. `NEEDS REAL ENDPOINT`.
- District select options. Current source: `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.

### Actions

- Select a district in radar dropdown. Backend trigger: fetch radar profile for district if not preloaded.
- Select district in embedding. Backend trigger: navigate/fetch detail.
- Toggle active cluster in embedding. Backend trigger: optional server-side filter for large data.
- Hover charts. Backend trigger: none.

### Recommended API

Analytics are derived and can be expensive; backend should return precomputed model artifacts via REST. Use SSE only for model retrain completion/status.

```http
GET /api/analytics/summary?year=2023
GET /api/analytics/embedding?modelVersion=latest
GET /api/analytics/shap?modelVersion=latest
GET /api/analytics/cause-prevalence?from=2018&to=2023
GET /api/analytics/histogram?metric=reading3&bins=8
GET /api/analytics/correlation?features=reading3,arith5,ndviVar,floodDays,ptr,vacancyRate,newsMigration,infraScore
GET /api/districts/{districtId}/radar?modelVersion=latest
GET /api/stream/model-status
```

```ts
interface AnalyticsSummaryResponse {
  totalDistricts: number;
  clusteredDistricts: number;
  noiseDistricts: number;
  silhouette: number;
  modelVersion: string;
  trainedAt: string;
}

interface EmbeddingPoint {
  districtId: string;
  name: string;
  cluster: ClusterId;
  confidence: number;
  reading3: number;
  x: number;
  y: number;
}

interface EmbeddingResponse {
  modelVersion: string;
  projection: "umap" | "tsne" | "pca";
  distance: string;
  points: EmbeddingPoint[];
}

interface ShapResponse {
  modelVersion: string;
  rows: Array<{
    districtId: string;
    cluster: ClusterId;
    feature: string;
    contribution: number;
  }>;
}

interface CausePrevalenceResponse {
  rows: Array<{ year: number } & Record<ClusterId, number>>;
}

interface HistogramResponse {
  metric: string;
  bins: Array<{
    lo: number;
    hi: number;
    byCluster: Partial<Record<ClusterId, number>>;
  }>;
}

interface CorrelationResponse {
  features: string[];
  matrix: number[][];
}

interface RadarResponse {
  districtId: string;
  axes: Array<{ key: string; label: string; higherIsBetter: boolean }>;
  series: Array<{
    label: "District" | "Cluster avg" | "National avg";
    values: number[];
  }>;
}
```

## Pipeline - `src/views/PipelineView.jsx`

### Data Displayed

- Source list: label, provider, record counts, freshness, rates, source icon. Current source: local `PIPE_SOURCES` and `D.SOURCE_META`. `NEEDS REAL ENDPOINT`.
- Pipeline stages: stage id, title, subtitle, detail, metric, metric label. Current source: local `PIPE_STAGES`. `NEEDS REAL ENDPOINT`.
- Observability strip: docs/day, sources live, median freshness, dedup rate, classifier F1, last retrain. Current source: local mock array. `NEEDS REAL ENDPOINT`.
- Live ingestion throughput sparkline. Current source: randomized `setInterval`. `NEEDS REAL ENDPOINT`.
- Source health list: rate and freshness. Current source: local `PIPE_SOURCES`. `NEEDS REAL ENDPOINT`.

### Actions

- No user-submitted backend mutations.
- Sparkline auto-updates. Backend should stream real throughput.

### Recommended API

Use REST GET for initial DAG and observability snapshot. Use SSE for server-to-client metric updates because the UI is read-only live telemetry.

```http
GET /api/pipeline/overview
GET /api/pipeline/sources
GET /api/pipeline/stages
GET /api/stream/pipeline
```

```ts
interface PipelineSource {
  id: string;
  label: string;
  via: string;
  records: string;
  freshMin: number;
  rate: number;
  kind: EvidenceSourceType;
  status: "healthy" | "degraded" | "offline";
}

interface PipelineStage {
  id: string;
  title: string;
  sub: string;
  detail: string;
  metric: string;
  metricLabel: string;
  status: "running" | "waiting" | "failed" | "complete";
}

interface PipelineOverviewResponse {
  status: "running" | "degraded" | "offline";
  stats: Array<{ label: string; value: string; accent?: string; sub: string }>;
  throughput: Array<{ timestamp: string; docsPerMin: number }>;
  sources: PipelineSource[];
  stages: PipelineStage[];
}

type PipelineEvent =
  | { type: "throughput"; point: { timestamp: string; docsPerMin: number } }
  | { type: "source_status"; source: PipelineSource }
  | { type: "stage_status"; stage: PipelineStage }
  | { type: "overview"; stats: PipelineOverviewResponse["stats"] };
```

## Cause Clusters - `src/views/ClustersView.jsx`

### Data Displayed

- Cluster cards: cluster label, short name, blurb, signature bullets, intervention window, district count, average reading, top intervention, confidence/effect fields. Current source: `D.CLUSTERS`, `D.DISTRICTS`, `D.INTERVENTIONS`. `NEEDS REAL ENDPOINT`.
- District chips within cluster: district name, reading score. Current source: `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.
- Best intervention: type, ASER delta, evidence count. Current source: `D.INTERVENTIONS`. `NEEDS REAL ENDPOINT`.

### Actions

- Click district chip. Backend trigger: fetch district detail.
- View evidence/peer workflow links. Backend trigger: none until target view loads.

### Recommended API

Cluster definitions are moderately static, but counts and recommended interventions are model-derived. Use REST GET.

```http
GET /api/clusters
GET /api/clusters/{clusterId}
GET /api/clusters/{clusterId}/districts
GET /api/clusters/{clusterId}/interventions?sort=aserDelta&limit=1
```

```ts
interface ClusterCardSummary {
  cluster: Cluster;
  districtCount: number;
  avgReading3: number;
  districts: Array<Pick<District, "id" | "name" | "reading3" | "cluster">>;
  bestIntervention: Intervention | null;
}

interface ClustersResponse {
  items: ClusterCardSummary[];
}
```

## District Detail - `src/views/DistrictView.jsx`

### Data Displayed

- District name, state, cluster badge, confidence, reading, arithmetic, YoY, gender gap, feature table, source evidence, SHAP waterfall, radar, trend chart, peer districts, intervention recommendations. Current source: `D.byId`, `D.INTERVENTIONS`, chart utilities. `NEEDS REAL ENDPOINT`.
- Evidence clipping: raw source, source type/date, classification, reason, URL. Current source: `district.evidence`. `NEEDS REAL ENDPOINT`.
- Peer chips: peer district names, state, cluster, reading score. Current source: `D.byId` by peer ids. `NEEDS REAL ENDPOINT`.

### Actions

- Back to all districts. Backend trigger: none.
- Run live scan. Backend trigger: create live scan job for district.
- Expand/collapse evidence reason. Backend trigger: none.
- View source link. Backend trigger: optional audit logging; should open `EvidenceItem.url`.
- Select peer district. Backend trigger: fetch selected district detail.
- Compare/all peer buttons. Backend trigger: fetch peers view data.

### Recommended API

Use REST GET for district detail. Use POST to start scan. Use SSE for scan progress.

```http
GET /api/districts/{districtId}
GET /api/districts/{districtId}/evidence
GET /api/districts/{districtId}/features
GET /api/districts/{districtId}/peers
GET /api/districts/{districtId}/interventions
POST /api/districts/{districtId}/scan
GET /api/stream/scans/{scanId}
```

```ts
interface DistrictDetailResponse {
  district: District;
  cluster: Cluster;
  features: Array<{ key: string; label: string; value: number | string; unit?: string }>;
  evidence: EvidenceItem[];
  peers: Array<Pick<District, "id" | "name" | "state" | "cluster" | "reading3">>;
  interventions: Intervention[];
}

interface StartScanRequest {
  sources?: EvidenceSourceType[];
  priority?: "normal" | "high";
}

interface StartScanResponse {
  scanId: string;
  districtId: string;
  status: "queued" | "running";
  streamUrl: string;
}
```

## Evidence Engine - `src/views/EvidenceView.jsx`

### Data Displayed

- Scan target dropdown: all districts. Current source: `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.
- Live scan console: scan step labels, current status, discovered evidence. Current source: `D.SCAN_STEPS`, timers, selected district evidence. `NEEDS REAL ENDPOINT`.
- Classification counts: Supporting, Contradicting, Irrelevant. Current source: derived from all `D.DISTRICTS[].evidence`. `NEEDS REAL ENDPOINT`.
- Source filter chips: source labels/icons and counts. Current source: `D.SOURCE_META`, derived evidence. `NEEDS REAL ENDPOINT`.
- Evidence feed: district name/state, cluster dot, evidence clipping. Current source: flattened mock evidence. `NEEDS REAL ENDPOINT`.

### Actions

- Select target district. Backend trigger: none until scan or evidence query.
- Run live scan. Backend trigger: POST scan job.
- Filter classification/source. Backend trigger: either client filter on loaded feed or REST query with filters.
- Select evidence item district. Backend trigger: fetch district detail.
- View scan results. Backend trigger: fetch latest evidence for scan district or apply feed filter.

### Recommended API

Use REST GET for evidence feed. Use POST plus SSE for scan because progress is one-way server-to-client.

```http
GET /api/evidence?districtId={id?}&classification={classification?}&sourceType={sourceType?}&limit=50&cursor={cursor?}
GET /api/evidence/summary
POST /api/scans
GET /api/scans/{scanId}
GET /api/stream/scans/{scanId}
```

```ts
interface EvidenceFeedItem extends EvidenceItem {
  districtName: string;
  districtState: string;
  cluster: ClusterId;
}

interface EvidenceFeedResponse {
  items: EvidenceFeedItem[];
  nextCursor?: string;
}

interface EvidenceSummaryResponse {
  classificationCounts: Record<EvidenceClassification, number>;
  sourceCounts: Partial<Record<EvidenceSourceType, number>>;
  sourceMeta: Record<EvidenceSourceType, SourceMeta>;
}

interface CreateScanRequest {
  districtId: string;
  sources?: EvidenceSourceType[];
}

interface ScanStatusResponse {
  scanId: string;
  districtId: string;
  status: "queued" | "running" | "complete" | "failed";
  steps: ScanStep[];
  found: EvidenceItem[];
}

type ScanEvent =
  | { type: "step"; step: ScanStep }
  | { type: "evidence"; item: EvidenceItem }
  | { type: "complete"; scan: ScanStatusResponse }
  | { type: "error"; message: string };
```

## Workflow - `src/views/WorkflowView.jsx`

This file contains three views: Peers & Interventions, Intervention Tracker, and Alerts.

### Peers & Interventions Data Displayed

- Anchor district select options. Current source: `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.
- Peer network graph: districts, peer links, cluster, reading score, transfer link count. Current source: `D.DISTRICTS[].peers`. `NEEDS REAL ENDPOINT`.
- Metrics comparison table: reading, arithmetic, YoY reading, PTR, vacancy rate, confidence. Current source: selected district and peers. `NEEDS REAL ENDPOINT`.
- Transferable interventions: type, ASER delta, districts, evidence count, blurb. Current source: `D.INTERVENTIONS`. `NEEDS REAL ENDPOINT`.

### Peers & Interventions Actions

- Select anchor district. Backend trigger: fetch peer comparison/network for anchor.
- Click peer/network node. Backend trigger: select/fetch that district or navigate detail.

```http
GET /api/peers?anchorId={districtId}
GET /api/peer-network?anchorId={districtId?}
GET /api/districts/{districtId}/comparison?peerIds={ids}
```

```ts
interface PeerNetworkResponse {
  nodes: Array<Pick<District, "id" | "name" | "cluster" | "reading3" | "peers">>;
  edges: Array<{ source: string; target: string; weight?: number; reason?: string }>;
}

interface PeerComparisonResponse {
  anchorId: string;
  group: District[];
  metrics: Array<{ key: keyof District; label: string; better: "high" | "low" }>;
  interventions: Intervention[];
}
```

### Tracker Data Displayed

- Live interventions count, cumulative lift, covered districts. Current source: derived from `D.TRACKER`. `NEEDS REAL ENDPOINT`.
- Tracker rows: status, district, type, started, baseline/latest/target, progress, note. Current source: `D.TRACKER`, `D.byId`. `NEEDS REAL ENDPOINT`.

### Tracker Actions

- Select tracker district. Backend trigger: fetch district detail.
- No create/update controls yet, but backend should support future intervention lifecycle updates.

```http
GET /api/intervention-tracker
POST /api/intervention-tracker
PATCH /api/intervention-tracker/{trackerId}
GET /api/stream/intervention-tracker
```

Use REST for initial list and mutations. Use SSE for low-frequency program status/outcome updates.

```ts
interface TrackerResponse {
  summary: {
    active: number;
    cumulativeLift: number;
    districtsCovered: number;
  };
  items: Array<TrackerItem & { districtName: string; cluster: ClusterId }>;
}

interface UpsertTrackerRequest {
  district: string;
  type: string;
  started?: string;
  status: TrackerStatus;
  baseline: number;
  latest: number;
  target: number;
  note?: string;
}
```

### Alerts Data Displayed

- Alerts list: level, when, title, body, district, cluster. Current source: `D.ALERTS`. `NEEDS REAL ENDPOINT`.
- Alert styling metadata. Current source: local `levelMeta`. Can remain frontend static unless backend controls severity colors.

### Alerts Actions

- Click alert card. Backend trigger: optional mark as viewed; navigate district.

```http
GET /api/alerts?level={level?}&status=open&limit=50
PATCH /api/alerts/{alertId}
GET /api/stream/alerts
```

```ts
interface AlertsResponse {
  items: Alert[];
}

interface UpdateAlertRequest {
  status?: "open" | "acknowledged" | "resolved";
  viewedAt?: string;
}

type AlertEvent =
  | { type: "created"; alert: Alert }
  | { type: "updated"; alert: Alert }
  | { type: "deleted"; id: string };
```

## AI Analyst - `src/views/AIView.jsx`

### Data Displayed

- Auto-generated insight cards: type, label, metric, title, body, sources, related districts. Current source: local `AI_INSIGHTS`. `NEEDS REAL ENDPOINT`.
- Chat messages and source chips. Current source: local seed plus simulated response generator. `NEEDS REAL ENDPOINT`.
- Context district response if `currentDistrict` is passed. Current source: `D.byId`. `NEEDS REAL ENDPOINT`.

### Actions

- Close panel. Backend trigger: none.
- Click related district. Backend trigger: fetch district detail.
- Submit chat question. Backend trigger: send prompt and context to backend RAG service.

### Recommended API

Use REST GET for insight cards. Use streaming POST/SSE or WebSocket for chat. SSE is sufficient for one assistant response stream per user prompt; WebSocket is useful only if the assistant supports bidirectional tool status updates or shared sessions.

```http
GET /api/ai/insights?districtId={districtId?}&limit=10
POST /api/ai/chat
GET /api/stream/ai/chat/{messageId}
```

```ts
interface AIInsight {
  id: string;
  type: "critical" | "finding" | "opportunity";
  title: string;
  body: string;
  sources: string[];
  districts: string[];
  metric?: { label: string; value: string; color?: string };
}

interface AIInsightsResponse {
  items: AIInsight[];
}

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  sources?: string[];
  createdAt: string;
}

interface AIChatRequest {
  message: string;
  districtId?: string;
  conversationId?: string;
}

interface AIChatResponse {
  conversationId: string;
  messageId: string;
  message?: ChatMessage;
  streamUrl?: string;
}

type AIChatEvent =
  | { type: "token"; messageId: string; token: string }
  | { type: "sources"; messageId: string; sources: string[] }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; message: string };
```

## Map Component - `src/components/Map.jsx`

### Data Displayed

- State boundary paths. Current source: direct fetch from configurable GeoJSON URLs in `config.map.geoJsonUrls`, with fallback simplified local boundaries. `NEEDS REAL ENDPOINT` if backend should own map geometry.
- District points and peer lines. Current source: props from view using `D.DISTRICTS`. `NEEDS REAL ENDPOINT`.

### Actions

- Hover state/district. Backend trigger: none.
- Click district. Backend trigger: fetch district detail.

### Recommended API

For stable map geometry, REST GET with long cache headers is best. If using a third-party tile provider, the frontend can use `VITE_MAP_TILE_URL` and `VITE_MAP_API_KEY`.

```http
GET /api/map/india/states.geojson
GET /api/districts/map
```

```ts
interface MapGeometryResponse extends GeoJSON.FeatureCollection {}
```

## Charts Component - `src/components/Charts.jsx`

### Data Displayed

- Chart frames, tooltips, embeddings, SHAP, correlations, histograms, radar, trends, cause streams, peer network. Current source: props and `D.DISTRICTS`. `NEEDS REAL ENDPOINT` at the owning view level.

### Actions

- Hover chart marks. Backend trigger: none.
- Toggle cluster in embedding. Backend trigger: none unless server-side filtering is required.
- Select district/network node. Backend trigger: fetch district detail.

No standalone chart endpoints are required beyond the analytics, district, and peer endpoints above.

## UI Component - `src/components/UI.jsx`

Shared presentational primitives only. No backend contract beyond receiving typed data from views.

## Data Module - `src/data/data.js`

This is a mock bootstrap dataset and should be replaced by backend calls or a typed fixture layer for tests only.

### Mock Data Replacements

```http
GET /api/bootstrap
```

Use this only if the frontend wants a single initial payload for fast local rendering. Otherwise prefer view-specific endpoints.

```ts
interface BootstrapResponse {
  clusters: Record<ClusterId, Cluster>;
  featureLabels: Record<string, string>;
  districts: District[];
  interventions: Record<ClusterId, Intervention[]>;
  tracker: TrackerItem[];
  alerts: Alert[];
  scanSteps: Array<Omit<ScanStep, "index" | "status">>;
  sourceMeta: Record<EvidenceSourceType, SourceMeta>;
  clusterOrder: ClusterId[];
}
```

## Recommended Endpoint Summary

```http
GET  /api/me
GET  /api/navigation/summary
GET  /api/search
GET  /api/bootstrap

GET  /api/overview
GET  /api/districts/map
GET  /api/districts/leaderboard
GET  /api/districts/{districtId}
GET  /api/districts/{districtId}/evidence
GET  /api/districts/{districtId}/features
GET  /api/districts/{districtId}/peers
GET  /api/districts/{districtId}/interventions
POST /api/districts/{districtId}/scan

GET  /api/clusters
GET  /api/clusters/{clusterId}
GET  /api/clusters/{clusterId}/districts
GET  /api/clusters/{clusterId}/interventions

GET  /api/evidence
GET  /api/evidence/summary
POST /api/scans
GET  /api/scans/{scanId}

GET  /api/analytics/summary
GET  /api/analytics/embedding
GET  /api/analytics/shap
GET  /api/analytics/cause-prevalence
GET  /api/analytics/histogram
GET  /api/analytics/correlation
GET  /api/districts/{districtId}/radar

GET  /api/pipeline/overview
GET  /api/pipeline/sources
GET  /api/pipeline/stages

GET  /api/peers
GET  /api/peer-network
GET  /api/districts/{districtId}/comparison

GET  /api/intervention-tracker
POST /api/intervention-tracker
PATCH /api/intervention-tracker/{trackerId}

GET  /api/alerts
PATCH /api/alerts/{alertId}

GET  /api/ai/insights
POST /api/ai/chat

GET  /api/map/india/states.geojson
```

## Recommended Real-Time Summary

Use SSE for:

- `/api/stream/app-summary` - badge counts and pipeline state.
- `/api/stream/overview` - KPI and evidence count updates.
- `/api/stream/pipeline` - read-only telemetry and throughput.
- `/api/stream/scans/{scanId}` - scan progress and evidence discovery.
- `/api/stream/model-status` - retrain/model artifact updates.
- `/api/stream/intervention-tracker` - program progress updates.
- `/api/stream/alerts` - alert creation/update.
- `/api/stream/ai/chat/{messageId}` - assistant token streaming.

Use WebSocket only if the backend later needs bidirectional collaboration, live analyst presence, or multi-step AI tool controls. Current UI patterns are mostly one-way server-to-client streams, so SSE is simpler and appropriate.
