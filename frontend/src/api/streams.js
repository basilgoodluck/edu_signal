import config from "../config.js";

export function createEventSource(path) {
  return new EventSource((config.api.baseUrl || "") + path);
}

function subscribe(path, onEvent) {
  const source = createEventSource(path);
  source.onmessage = (event) => onEvent(JSON.parse(event.data));
  return () => source.close();
}

export const subscribeAppSummary = (onEvent) => subscribe("/api/stream/app-summary", onEvent);
export const subscribeOverview = (onEvent) => subscribe("/api/stream/overview", onEvent);
export const subscribePipeline = (onEvent) => subscribe("/api/stream/pipeline", onEvent);
export const subscribeScan = (scanId, onEvent) => subscribe(`/api/stream/scans/${scanId}`, onEvent);
export const subscribeAlerts = (onEvent) => subscribe("/api/stream/alerts", onEvent);
export const subscribeTracker = (onEvent) => subscribe("/api/stream/intervention-tracker", onEvent);
export const subscribeAIChat = (messageId, onEvent) => subscribe(`/api/stream/ai/chat/${messageId}`, onEvent);
