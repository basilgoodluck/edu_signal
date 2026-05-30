import { get } from "./client.js";

export const getAnalyticsSummary = (year) => get("/api/analytics/summary", { year });
export const getEmbedding = () => get("/api/analytics/embedding");
export const getShap = () => get("/api/analytics/shap");
export const getCausePrevalence = (from, to) => get("/api/analytics/cause-prevalence", { from, to });
export const getHistogram = (metric, bins) => get("/api/analytics/histogram", { metric, bins });
export const getCorrelation = (features) => get("/api/analytics/correlation", { features: Array.isArray(features) ? features.join(",") : features });
export const getPipelineOverview = () => get("/api/pipeline/overview");
export const getPipelineSources = () => get("/api/pipeline/sources");
export const getPipelineStages = () => get("/api/pipeline/stages");
