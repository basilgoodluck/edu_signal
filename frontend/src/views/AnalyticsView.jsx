import { useEffect, useState } from "react";
import { getAnalyticsSummary } from "../api/analytics.js";
import { getDistrictsMap } from "../api/overview.js";
import { ClusterDot, CLUSTER_ORDER, clusterMeta } from "../components/UI.jsx";
import { ChartFrame, ClusterEmbedding, ShapBeeswarm, CorrHeatmap, ScoreHistogram, RadarChart, CauseStream, setChartData } from "../components/Charts.jsx";
import { PageHeader } from "./OverviewView.jsx";
/* EduSignal â€” Signal Lab: the analytics showcase page */

function StatChip({ label, value, accent }) {
  return (
    <div style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--surface)" }}>
      <div className="tnum" style={{ fontSize: 19, fontWeight: 700, color: accent || "var(--ink)", letterSpacing: "-0.02em" }}>{value}</div>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SignalLab({ onSelectDistrict }) {
  const [radarDistrict, setRadarDistrict] = useState("");
  const [districts, setDistricts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getAnalyticsSummary(), getDistrictsMap()])
      .then(([summaryData, mapData]) => {
        const loadedDistricts = mapData.districts || [];
        setSummary(summaryData);
        setDistricts(loadedDistricts);
        setChartData(loadedDistricts);
        setRadarDistrict((current) => loadedDistricts.some((district) => district.id === current) ? current : loadedDistricts[0]?.id || current);
      })
      .catch((err) => setError(err.message || "Failed to load analytics"));
  }, []);

  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;
  if (!summary) return <div style={{ padding: 30 }} className="mono">Loading analytics...</div>;

  const total = summary.totalDistricts || districts.length;
  const clustered = summary.clusteredDistricts || districts.filter((d) => d.cluster !== "noise").length;
  const silhouette = summary.silhouette || 0;
  const noiseN = summary.noiseDistricts ?? (total - clustered);

  return (
    <div className="fade-up" style={{ padding: "26px 30px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <PageHeader
        title="Signal Lab"
        sub="The model's working memory â€” embeddings, feature attributions and correlations behind every cluster assignment."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <StatChip label="Silhouette" value={silhouette} accent="var(--ok)" />
            <StatChip label="Clustered" value={clustered + "/" + total} />
            <StatChip label="Noise" value={noiseN} accent="var(--ink-3)" />
          </div>
        }
      />

      {/* row 1: embedding (big) + beeswarm */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)", gap: 18, marginBottom: 18 }}>
        <ChartFrame title="District embedding" caption="UMAP projection Â· HDBSCAN clusters Â· marker size âˆ severity"
          right={<span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", padding: "3px 8px", border: "1px solid var(--border)", borderRadius: 99 }}>2D Â· cosine</span>}>
          <ClusterEmbedding onSelect={onSelectDistrict} height={440} />
        </ChartFrame>
        <ChartFrame title="SHAP feature attribution" caption="each dot = one district Â· colour = its cluster">
          <ShapBeeswarm height={440} />
        </ChartFrame>
      </div>

      {/* row 2: streamgraph + histogram */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)", gap: 18, marginBottom: 18 }}>
        <ChartFrame title="Cause prevalence over time" caption="districts flagged per cause Â· 2018â€“2023 Â· stream-stacked">
          <CauseStream height={260} />
        </ChartFrame>
        <ChartFrame title="Reading-score distribution" caption="Grade-3 reading %, stacked by dominant cause"
          footer={<div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{CLUSTER_ORDER.filter((c) => c !== "noise").map((cid) => <span key={cid} className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--ink-3)" }}><ClusterDot cluster={cid} size={7} />{clusterMeta(cid).short}</span>)}</div>}>
          <ScoreHistogram height={230} />
        </ChartFrame>
      </div>

      {/* row 3: correlation + radar + trend */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18 }}>
        <ChartFrame title="Feature correlation" caption="Pearson r across all districts Â· blue âˆ’ / red +"
          right={<span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>n = {total}</span>}>
          <CorrHeatmap height={360} />
        </ChartFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <ChartFrame title="Feature radar" caption="district vs cluster vs national, normalised"
            right={<DistrictSelect value={radarDistrict} onChange={setRadarDistrict} districts={districts} />}>
            <RadarChart districtId={radarDistrict} height={300} />
          </ChartFrame>
        </div>
      </div>
    </div>
  );
}

function DistrictSelect({ value, onChange, filter, districts = [] }) {
  const list = filter ? districts.filter(filter) : districts;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ fontFamily: "var(--mono)", fontSize: 11.5, padding: "5px 9px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600 }}>
      {list.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}

export { SignalLab, DistrictSelect, StatChip };
export default SignalLab;
