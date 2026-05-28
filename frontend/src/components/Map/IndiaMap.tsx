import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import * as topojson from "topojson-client"
import type { District, ClusterAssignment } from "../../types"

const GEO_URL = "https://raw.githubusercontent.com/deldersveld/topojson/master/countries/india/india-districts.json"

export const CLUSTER_COLORS: Record<string, string> = {
  seasonal_migration: "#EF9F27",
  teacher_shortage: "#E24B4A",
  language_barrier: "#7F77DD",
  infrastructure: "#1D9E75",
  pedagogical_failure: "#378ADD",
  default: "#C8C6BE",
}

export const CLUSTER_LABELS: Record<string, string> = {
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
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; name: string } | null>(null)

  const districtByName = Object.fromEntries(districts.map((d) => [d.name.toLowerCase(), d]))

  function getColor(geoName: string) {
    const d = districtByName[geoName?.toLowerCase()]
    if (!d) return CLUSTER_COLORS.default
    const c = clusterMap[d.id]
    if (!c) return CLUSTER_COLORS.default
    if (filterCluster && c.cluster_label !== filterCluster) return "#E8E6DF"
    return CLUSTER_COLORS[c.cluster_label] ?? CLUSTER_COLORS.default
  }

  useEffect(() => {
    if (!svgRef.current) return

    const width = svgRef.current.clientWidth || 600
    const height = svgRef.current.clientHeight || 700

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const projection = d3.geoMercator().center([82, 22]).scale(1000).translate([width / 2, height / 2])
    const path = d3.geoPath().projection(projection)

    const g = svg.append("g")

    // zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => g.attr("transform", event.transform))
    svg.call(zoom)

    d3.json(GEO_URL).then((topo: any) => {
      const geojson = topojson.feature(topo, topo.objects[Object.keys(topo.objects)[0]]) as any

      g.selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", path as any)
        .attr("fill", (d: any) => {
          const name = d.properties.NAME_2 || d.properties.name || ""
          return getColor(name)
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.3)
        .style("cursor", (d: any) => {
          const name = d.properties.NAME_2 || d.properties.name || ""
          return districtByName[name?.toLowerCase()] ? "pointer" : "default"
        })
        .on("mouseover", function (event, d: any) {
          const name = d.properties.NAME_2 || d.properties.name || ""
          d3.select(this).attr("stroke-width", 0.8).attr("stroke", "#333")
          setTooltip({ x: event.offsetX, y: event.offsetY, name })
        })
        .on("mousemove", function (event) {
          setTooltip((prev) => prev ? { ...prev, x: event.offsetX, y: event.offsetY } : null)
        })
        .on("mouseout", function () {
          d3.select(this).attr("stroke-width", 0.3).attr("stroke", "#fff")
          setTooltip(null)
        })
        .on("click", (_event, d: any) => {
          const name = d.properties.NAME_2 || d.properties.name || ""
          const district = districtByName[name?.toLowerCase()]
          if (district) onSelect(district.id)
        })
    })
  }, [districts, clusterMap, selectedId, filterCluster])

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", borderRadius: 12, overflow: "hidden" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: tooltip.y - 8,
            background: "var(--color-background-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            color: "var(--color-text-primary)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {tooltip.name}
        </div>
      )}
    </div>
  )
}