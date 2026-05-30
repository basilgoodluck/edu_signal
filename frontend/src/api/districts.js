import { get, post } from "./client.js";

export const getDistrict = (id) => get(`/api/districts/${id}`);
export const getDistrictEvidence = (id) => get(`/api/districts/${id}/evidence`);
export const getDistrictFeatures = (id) => get(`/api/districts/${id}/features`);
export const getDistrictPeers = (id) => get(`/api/districts/${id}/peers`);
export const getDistrictInterventions = (id) => get(`/api/districts/${id}/interventions`);
export const getDistrictRadar = (id) => get(`/api/districts/${id}/radar`);
export const startDistrictScan = (id, body) => post(`/api/districts/${id}/scan`, body || {});
