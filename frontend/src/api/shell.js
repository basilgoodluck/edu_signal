import { get } from "./client.js";

export const getMe = () => get("/api/me");
export const getNavSummary = () => get("/api/navigation/summary");
export const search = (q, types) => get("/api/search", { q, types });
export const getBootstrap = () => get("/api/bootstrap");
