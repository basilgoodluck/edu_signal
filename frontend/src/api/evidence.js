import { get, post } from "./client.js";

export const getEvidence = (params) => get("/api/evidence", params);
export const getEvidenceSummary = () => get("/api/evidence/summary");
export const createScan = (body) => post("/api/scans", body);
export const getScan = (id) => get(`/api/scans/${id}`);
