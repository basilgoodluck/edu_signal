import { get, patch, post } from "./client.js";

export const getPeers = (anchorId) => get("/api/peers", { anchorId });
export const getPeerNetwork = (anchorId) => get("/api/peer-network", { anchorId });
export const getComparison = (districtId, peerIds) => get(`/api/districts/${districtId}/comparison`, { peerIds: Array.isArray(peerIds) ? peerIds.join(",") : peerIds });
export const getTracker = () => get("/api/intervention-tracker");
export const createTrackerItem = (body) => post("/api/intervention-tracker", body);
export const updateTrackerItem = (id, body) => patch(`/api/intervention-tracker/${id}`, body);
export const getAlerts = (params) => get("/api/alerts", params);
export const updateAlert = (id, body) => patch(`/api/alerts/${id}`, body);
