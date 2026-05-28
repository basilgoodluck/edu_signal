import { useState } from "react"
import type { DistrictDetail } from "../../types"
import ClusterBadge from "./ClusterBadge"
import FeatureBreakdown from "./FeatureBreakdown"
import PeerList from "./PeerList"
import EvidenceList from "../Evidence/EvidenceList"
import ShapWaterfall from "../Charts/ShapWaterfall"
import InterventionPanel from "../Interventions/InterventionPanel"
import { api } from "../../api/client"
import { usePollJob } from "../../hooks/usePollJob"

type Tab = "evidence" | "features" | "peers" | "interventions"

interface Props {
  detail: DistrictDetail
  onSelectPeer: (id: string) => void
  onClose: () => void
}

export default function DistrictPanel({ detail, onSelectPeer, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("evidence")
  const [jobId, setJobId] = useState<string | null>(null)
  const jobStatus = usePollJob(jobId)

  const { district, cluster, features, evidence, peers } = detail

  async function handleAnalyze() {
    const { job_id } = await api.triggerAnalyze(district.id)
    setJobId(job_id)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "evidence", label: "Evidence" },
    { key: "features", label: "Features" },
    { key: "peers", label: `Peers (${peers.length})` },
    { key: "interventions", label: "Interventions" },
  ]

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--color-background-primary)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 0",
          borderBottom: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {district.name}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--color-text-tertiary)" }}>
              {district.state}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--color-text-tertiary)",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {cluster && (
          <div style={{ marginBottom: 14 }}>
            <ClusterBadge label={cluster.cluster_label} confidence={cluster.confidence} />
          </div>
        )}

        {/* Analyze button */}
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleAnalyze}
            disabled={jobStatus?.status === "running" || jobStatus?.status === "pending"}
            style={{
              fontSize: 12,
              padding: "6px 14px",
              borderRadius: 6,
              border: "0.5px solid var(--color-border-secondary)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-text-primary)",
            }}
          >
            {jobStatus?.status === "running" || jobStatus?.status === "pending"
              ? "Scraping…"
              : "Refresh live data"}
          </button>
          {jobStatus?.status === "complete" && (
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              {jobStatus.result?.evidence_saved} items saved
            </span>
          )}
          {jobStatus?.status === "failed" && (
            <span style={{ fontSize: 12, color: "#E24B4A" }}>Scrape failed</span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                border: "none",
                borderBottom: tab === t.key
                  ? "2px solid var(--color-text-primary)"
                  : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
                color: tab === t.key ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                fontWeight: tab === t.key ? 500 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {tab === "evidence" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {cluster && Object.keys(cluster.shap_values).length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: "0 0 10px" }}>
                  Why this cluster was assigned
                </p>
                <ShapWaterfall shapValues={cluster.shap_values} />
              </div>
            )}
            <EvidenceList evidence={evidence} />
          </div>
        )}

        {tab === "features" && features && <FeatureBreakdown features={features} />}

        {tab === "peers" && <PeerList peers={peers} onSelect={onSelectPeer} />}

        {tab === "interventions" && cluster && (
          <InterventionPanel clusterId={cluster.cluster_id} />
        )}
      </div>
    </div>
  )
}