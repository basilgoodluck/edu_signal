import type { ClusterLabel } from "../../types"
import { CLUSTER_COLORS, CLUSTER_LABELS } from "../Map/IndiaMap"

const CLUSTER_ICONS: Record<ClusterLabel, string> = {
  seasonal_migration: "🌾",
  teacher_shortage: "👤",
  language_barrier: "🗣",
  infrastructure: "🏗",
  pedagogical_failure: "📚",
}

interface Props {
  label: ClusterLabel
  confidence: number
}

export default function ClusterBadge({ label, confidence }: Props) {
  const color = CLUSTER_COLORS[label]
  const text = CLUSTER_LABELS[label]
  const pct = Math.round(confidence * 100)

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        borderRadius: 8,
        border: `0.5px solid ${color}`,
        background: `${color}12`,
      }}
    >
      <span style={{ fontSize: 16 }}>{CLUSTER_ICONS[label]}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color }}>{text}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {pct}% confidence
        </div>
      </div>
    </div>
  )
}