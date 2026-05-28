import { useState, useEffect } from "react"
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps"
import type { District, ClusterAssignment } from "../../types"

const GEO_URL = "https://raw.githubusercontent.com/deldersveld/topojson/master/countries/india/india-districts.json"

const CLUSTER_COLORS: Record<string, string> = {
  seasonal_migration: "#EF9F27",
  teacher_shortage: "#E24B4A",
  language_barrier: "#7F77DD",
  infrastructure: "#1D9E75",
  pedagogical_failure: "#378ADD",
  default: "#888780",
}

const CLUSTER_LABELS: Record<string, string> = {
  seasonal_migration: "Seasonal migration",
  teacher_shortage: "Teacher shortage",
  language_barrier: "Language barrier",
  infrastructure: "Infrastructure",
  pedagogical_failure: "Pedagogical failure",
}

interface Props {
  districts: District[]
  clusterMap: Record<string, ClusterAssignment>
  selectedId: string | null
  onSelect: (id: string) => void
  filterCluster: string | null
}

export default function IndiaMap({ districts, clusterMap, selectedId, onSelect, filterCluster }: Props) {
  const districtByName = Object.fromEntries(districts.map((d) => [d.name.toLowerCase(), d]))

  function getColor(geoName: string) {
    const d = districtByName[geoName?.toLowerCase()]
    if (!d) return CLUSTER_COLORS.default
    const c = clusterMap[d.id]
    if (!c) return CLUSTER_COLORS.default
    if (filterCluster && c.cluster_label !== filterCluster) return "#D3D1C7"
    return CLUSTER_COLORS[c.cluster_label] ?? CLUSTER_COLORS.default
  }

  return (
    <div style={{ width: "100%", background: "var(--color-background-secondary)", borderRadius: 12 }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 1000, center: [82, 22] }}
        style={{ width: "100%", height: "auto" }}
      >
        <ZoomableGroup>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties.NAME_2 || geo.properties.name || ""
                const d = districtByName[geoName?.toLowerCase()]
                const isSelected = d?.id === selectedId
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => d && onSelect(d.id)}
                    style={{
                      default: {
                        fill: getColor(geoName),
                        stroke: "var(--color-background-primary)",
                        strokeWidth: isSelected ? 0 : 0.3,
                        outline: "none",
                        cursor: d ? "pointer" : "default",
                        filter: isSelected ? "brightness(1.15)" : "none",
                      },
                      hover: {
                        fill: getColor(geoName),
                        stroke: "var(--color-background-primary)",
                        strokeWidth: 0.6,
                        outline: "none",
                        cursor: d ? "pointer" : "default",
                        filter: "brightness(1.1)",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  )
}

export { CLUSTER_COLORS, CLUSTER_LABELS }