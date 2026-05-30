import { get, post } from "./client.js";

export const getInsights = (districtId, limit) => get("/api/ai/insights", { districtId, limit });
export const sendChat = (body) => post("/api/ai/chat", body);
