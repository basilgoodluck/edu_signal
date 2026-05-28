import type { District, DistrictDetail, Intervention, JobStatus } from "../types"

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  getDistricts: () => get<District[]>("/districts"),
  getDistrict: (id: string) => get<DistrictDetail>(`/districts/${id}`),
  getClusterPeers: (clusterId: number) => get<District[]>(`/cluster/${clusterId}/peers`),
  getClusterInterventions: (clusterId: number) => get<Intervention[]>(`/cluster/${clusterId}/interventions`),
  triggerAnalyze: (districtId: string) => post<{ job_id: string }>("/analyze", { district_id: districtId }),
  pollJob: (jobId: string) => get<JobStatus>(`/analyze/${jobId}`),
  classifyEvidence: (evidenceText: string, clusterType: string) =>
    post("/evidence/classify", { evidence_text: evidenceText, cluster_type: clusterType }),
}