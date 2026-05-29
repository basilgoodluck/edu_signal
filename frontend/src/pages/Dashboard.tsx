import { useState } from "react"
import { useDistricts, useDistrict } from "../hooks/useDistrict"
import IndiaMap from "../components/Map/IndiaMap"
import MapLegend from "../components/Map/MapLegend"
import DistrictPanel from "../components/District/DistrictPanel"
import type { ClusterAssignment, DistrictListItem } from "../types"

export default function Dashboard() {
  const { districts, loading } = useDistricts()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterCluster, setFilterCluster] = useState<string | null>(null)
  const { detail } = useDistrict(selectedId)

  // Build clusterMap from districts list (cluster_label + confidence included by API)
  const clusterMap: Record<string, ClusterAssignment> = Object.fromEntries(
    (districts as DistrictListItem[])
      .filter((d) => d.cluster_label)
      .map((d) => [
        d.id,
        {
          district_id: d.id,
          cluster_id: 0,
          cluster_label: d.cluster_label!,
          confidence: d.confidence ?? 0,
          shap_values: {},
          assigned_at: "",
        } as ClusterAssignment,
      ])
  )

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--color-background-secondary)" }}>
      {/* Left: map */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24, gap: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)", letterSpacing: "-0.3px" }}>
              EduSignal
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-tertiary)" }}>
              District learning intelligence
            </p>
          </div>
          {loading && (
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Loading districts…</span>
          )}
        </div>

        <MapLegend filterCluster={filterCluster} onFilter={setFilterCluster} />

        <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: "hidden" }}>
          <IndiaMap
            districts={districts}
            clusterMap={clusterMap}
            selectedId={selectedId}
            onSelect={setSelectedId}
            filterCluster={filterCluster}
          />
        </div>
      </div>

      {/* Right: district panel */}
      {detail && (
        <div
          style={{
            width: 420,
            borderLeft: "0.5px solid var(--color-border-tertiary)",
            background: "var(--color-background-primary)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <DistrictPanel
            detail={detail}
            onSelectPeer={(id) => setSelectedId(id)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  )
}