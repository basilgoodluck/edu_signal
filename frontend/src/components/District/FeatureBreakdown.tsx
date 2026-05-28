import type { DistrictFeatures } from "../../types"

const FEATURE_LABELS: Record<string, string> = {
  reading_grade3_pct: "Grade 3 reading",
  arithmetic_grade5_pct: "Grade 5 arithmetic",
  yoy_delta_reading: "Reading Δ YoY",
  gender_gap_reading: "Gender gap",
  teacher_vacancy_rate: "Vacancy rate",
  ptr: "Pupil-teacher ratio",
  infrastructure_score: "Infrastructure",
  ndvi_seasonal_variance: "NDVI variance",
  flood_days_per_year_avg: "Flood days/yr",
  road_connectivity_index: "Road connectivity",
  vacancy_portal_open_posts: "Open posts",
  news_migration_signal: "Migration signal",
  news_flood_signal: "Flood signal",
  forum_absenteeism_complaints: "Absenteeism reports",
}

interface Props {
  features: DistrictFeatures
}

function fmt(v: unknown) {
  if (v === null || v === undefined) return "—"
  if (typeof v === "number") return Number.isInteger(v) ? v.toString() : v.toFixed(2)
  return String(v)
}

export default function FeatureBreakdown({ features }: Props) {
  const entries = Object.entries(features.features).filter(([, v]) => v !== null && v !== undefined)

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1px",
        background: "var(--color-border-tertiary)",
        borderRadius: 8,
        overflow: "hidden",
        border: "0.5px solid var(--color-border-tertiary)",
      }}
    >
      {entries.map(([key, value]) => (
        <div
          key={key}
          style={{
            background: "var(--color-background-primary)",
            padding: "10px 14px",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>
            {FEATURE_LABELS[key] ?? key}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
            {fmt(value)}
          </div>
        </div>
      ))}
    </div>
  )
}