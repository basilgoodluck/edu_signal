import { get } from "./client.js";

export const getClusters = () => get("/api/clusters");
export const getCluster = (id) => get(`/api/clusters/${id}`);
export const getClusterDistricts = (id) => get(`/api/clusters/${id}/districts`);
export const getClusterInterventions = (id, params) => get(`/api/clusters/${id}/interventions`, params);
