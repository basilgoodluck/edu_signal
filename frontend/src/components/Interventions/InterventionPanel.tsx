import { useEffect, useState } from "react"
import { api } from "../../api/client"
import type { Intervention } from "../../types"

interface Props {
  clusterId: number
}

function deltaColor(v?: number) {
  if (v === undefined || v === null) return "var(--color-text-tertiary)"
  return v >= 0 ? "#1D9E75" : "#E24B4A"
}

export default function InterventionPanel({ clusterId }: Props) {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getClusterInterventions(clusterId)
      .then(setInterventions)
      .finally(() => setLoading(false))
  }, [clusterId])

  if (loading) return <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>Loading…</p>
  if (!interventions.length) return <p style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>No interventions recorded yet.</p>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {interventions.map((item) => (
        <div
          key={item.id}
          style={{
            padding: "14px 16px",
            borderRadius: 10,
            border: "0.5px solid var(--color-border-tertiary)",
            background: "var(--color-background-primary)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {item.intervention_type}
            </span>
            {item.aser_delta !== undefined && item.aser_delta !== null && (
              <span style={{ fontSize: 13, fontWeight: 500, color: deltaColor(item.aser_delta) }}>
                {item.aser_delta >= 0 ? "+" : ""}{item.aser_delta.toFixed(2)} ASER
              </span>
            )}
          </div>
          {item.notes && (
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
              {item.notes}
            </p>
          )}
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
            Started {item.started_at}
          </span>
        </div>
      ))}
    </div>
  )
}