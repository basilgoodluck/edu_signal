export type ClusterLabel =
  | "seasonal_migration"
  | "teacher_shortage"
  | "language_barrier"
  | "infrastructure"
  | "pedagogical_failure"

export interface District {
  id: string
  name: string
  state: string
  census_code?: string
  lat?: number
  lng?: number
}

export interface DistrictListItem extends District {
  cluster_label?: string
  confidence?: number
}

export interface ClusterAssignment {
  district_id: string
  cluster_id: number
  cluster_label: ClusterLabel
  confidence: number
  shap_values: Record<string, number>
  assigned_at: string
}

export interface Evidence {
  id: string
  district_id: string
  raw_text: string
  source_url?: string
  source_type: "news" | "vacancy_portal" | "forum" | "ngo_report" | "grievance_portal" | "govt_press_release"
  classification: "Supporting" | "Contradicting" | "Irrelevant"
  reason: string
  scraped_at: string
}

export interface DistrictFeatures {
  district_id: string
  year: number
  features: {
    reading_grade3_pct?: number
    arithmetic_grade5_pct?: number
    yoy_delta_reading?: number
    gender_gap_reading?: number
    ndvi_seasonal_variance?: number
    flood_days_per_year_avg?: number
    road_connectivity_index?: number
    teacher_vacancy_rate?: number
    ptr?: number
    infrastructure_score?: number
    vacancy_portal_open_posts?: number
    news_migration_signal?: number
    news_flood_signal?: number
    forum_absenteeism_complaints?: number
  }
}

export interface Intervention {
  id: string
  district_id: string
  intervention_type: string
  started_at: string
  aser_delta?: number
  notes?: string
}

export interface DistrictDetail {
  district: District
  cluster?: ClusterAssignment
  features?: DistrictFeatures
  evidence: Evidence[]
  peers: District[]
}

export interface JobStatus {
  job_id: string
  status: "queued" | "pending" | "running" | "complete" | "failed"
  result?: { evidence_saved: number }
  error?: string
}