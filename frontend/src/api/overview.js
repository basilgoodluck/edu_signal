import { get } from "./client.js";

export const getOverview = (year) => get("/api/overview", { year });
export const getDistrictsMap = (year, cluster) => get("/api/districts/map", { year, cluster });
export const getLeaderboard = (metric = "reading3", order = "asc", limit = 8, year) => get("/api/districts/leaderboard", { metric, order, limit, year });
