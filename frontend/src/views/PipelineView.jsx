import { useEffect, useState } from "react";
import { getPipelineOverview } from "../api/analytics.js";
import { subscribePipeline } from "../api/streams.js";
import { Icon, SectionLabel, SOURCE_META } from "../components/UI.jsx";
import { PageHeader } from "./OverviewView.jsx";
/* EduSignal - Data Pipeline & observability */

function freshLabel(min) {
  if (min >= 525600) return "static";
  if (min >= 1440) return Math.round(min / 1440) + "d";
  if (min >= 60) return Math.round(min / 60) + "h";
  return min + "m";
}

function PipelineView() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPipelineOverview().then(setOverview).catch((err) => setError(err.message || "Failed to load pipeline"));
    return subscribePipeline((event) => setOverview((current) => ({ ...(current || {}), ...event })));
  }, []);

  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;
  if (!overview) return <div style={{ padding: 30 }} className="mono">Loading pipeline...</div>;

  const obs = overview.stats || [];
  const sources = overview.sources || [];
  const stages = overview.stages || [];
  const throughput = overview.throughput || [];
  const maxThroughput = Math.max(...throughput.map((item) => item.docsPerMin || 0), 1);
  const spark = throughput.map((item, index) => {
    const x = throughput.length <= 1 ? 0 : (index / (throughput.length - 1)) * 560;
    const y = 90 - ((item.docsPerMin || 0) / maxThroughput) * 78 - 4;
    return [x, y];
  });
  const path = spark.map((point, index) => (index ? "L" : "M") + point[0].toFixed(1) + " " + point[1].toFixed(1)).join(" ");

  return (
    <div className="fade-up" style={{ padding: "26px 30px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <PageHeader
        title="Data Pipeline"
        sub="Six messy public sources -> one trustworthy feature store. Fused on district, point-in-time correct, retrained nightly."
        actions={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-2)", padding: "8px 13px", border: "1px solid var(--border)", borderRadius: 99 }} className="mono"><span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--ok)", animation: "pulse 2s infinite" }} />{(overview.status || "running").toUpperCase()}</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(obs.length, 1)}, 1fr)`, gap: 1, background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: 20 }}>
        {obs.map((o) => (
          <div key={o.label} style={{ background: "var(--surface)", padding: "14px 16px" }}>
            <div className="tnum" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--ink)" }}>{o.value}</div>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-3)", marginTop: 3 }}>{o.label}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 3 }}>{o.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)", padding: "20px 22px", marginBottom: 20 }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>Airflow DAG - {stages.length} stages</span>}>End-to-end lineage</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: `190px repeat(${Math.max(stages.length, 1)}, minmax(140px, 1fr))`, gap: 10, overflowX: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "var(--ink-faint)", textTransform: "uppercase", marginBottom: 3 }}>Sources - {sources.length}</div>
            {sources.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", background: "var(--surface)" }}>
                <span className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>{(SOURCE_META[s.kind] || { icon: "SRC" }).icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)" }}>{s.via}</div>
                </div>
              </div>
            ))}
          </div>
          {stages.map((st, i) => (
            <div key={st.id} style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ background: i === stages.length - 1 ? "var(--brand-tint)" : "var(--surface)", border: `1px solid ${i === stages.length - 1 ? "var(--brand)" : "var(--border-strong)"}`, borderRadius: "var(--r)", padding: "12px 12px", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 8.5, color: "var(--brand)", fontWeight: 600 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: st.status === "waiting" ? "var(--ink-faint)" : "var(--ok)", animation: "pulse 2s infinite" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{st.title}</div>
                <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-3)", marginBottom: 8 }}>{st.sub}</div>
                <div style={{ fontSize: 10.5, color: "var(--ink-2)", lineHeight: 1.4, marginBottom: 10, minHeight: 44 }}>{st.detail}</div>
                <div style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  <div className="mono tnum" style={{ fontSize: 17, fontWeight: 700 }}>{st.metric}</div>
                  <div className="mono" style={{ fontSize: 8.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{st.metricLabel}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 18 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)", padding: "18px 20px" }}>
          <SectionLabel right={<span className="mono tnum" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>{maxThroughput} docs/min peak</span>}>Live ingestion throughput</SectionLabel>
          <svg viewBox="0 0 560 90" width="100%" height="90" preserveAspectRatio="none" style={{ display: "block" }}>
            <path d={path ? path + " L 560 90 L 0 90 Z" : ""} fill="var(--brand)" opacity="0.08" />
            <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 6 }}>rolling API window - Bright Data workers auto-scaling</div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)", padding: "18px 20px" }}>
          <SectionLabel>Source health</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {sources.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: s.status === "healthy" ? "var(--ok)" : "var(--ink-faint)", flex: "none" }} />
                <span style={{ fontSize: 12, flex: 1, fontWeight: 500 }}>{s.label}</span>
                <span className="mono tnum" style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.rate ? s.rate + "/h" : "batch"}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", width: 34, textAlign: "right" }}>{freshLabel(s.freshMin)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { PipelineView };
export default PipelineView;
