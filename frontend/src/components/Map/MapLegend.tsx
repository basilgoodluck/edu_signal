import { CLUSTER_COLORS, CLUSTER_LABELS } from "./IndiaMap"

interface Props {
  filterCluster: string | null
  onFilter: (cluster: string | null) => void
}

export default function MapLegend({ filterCluster, onFilter }: Props) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 0" }}>
      {Object.entries(CLUSTER_LABELS).map(([key, label]) => {
        const active = filterCluster === key
        return (
          <button
            key={key}
            onClick={() => onFilter(active ? null : key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: 20,
              border: `0.5px solid ${active ? CLUSTER_COLORS[key] : "var(--color-border-tertiary)"}`,
              background: active ? `${CLUSTER_COLORS[key]}18` : "var(--color-background-primary)",
              cursor: "pointer",
              fontSize: 12,
              color: active ? CLUSTER_COLORS[key] : "var(--color-text-secondary)",
              fontWeight: active ? 500 : 400,
              transition: "all 0.15s",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: CLUSTER_COLORS[key],
                flexShrink: 0,
              }}
            />
            {label}
          </button>
        )
      })}
    </div>
  )
}