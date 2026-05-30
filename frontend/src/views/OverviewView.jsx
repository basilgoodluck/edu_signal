import { useEffect, useState } from "react";
import { getDistrictsMap, getLeaderboard, getOverview } from "../api/overview.js";
import { subscribeOverview } from "../api/streams.js";
import { Button, Card, ClusterDot, Icon, SectionLabel, Sparkline, Stat, CLUSTER_ORDER, CLUSTERS, clusterMeta, signed } from "../components/UI.jsx";
import { DistrictMap } from "../components/Map.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
/* EduSignal — Overview dashboard */

function ClusterLegend({ active, onToggle, counts }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {CLUSTER_ORDER.map((cid) => {
        const m = CLUSTERS[cid];
        const on = active === cid;
        return (
          <button key={cid} onClick={() => onToggle(on ? null : cid)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 8px",
              borderRadius: 99, fontSize: 12, fontWeight: 600,
              border: `1px solid ${on ? m.color : "var(--border)"}`,
              background: on ? m.tint : "var(--surface)", color: on ? m.color : "var(--ink-2)",
              transition: "all 0.14s",
            }}>
            <ClusterDot cluster={cid} size={8} />
            {m.short}
            <span className="mono tnum" style={{ fontSize: 10.5, color: on ? m.color : "var(--ink-faint)", fontWeight: 600 }}>{counts[cid] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

function DistributionBar({ counts, total, onSelect, active }) {
  return (
    <div>
      <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", border: "1px solid var(--border)" }}>
        {CLUSTER_ORDER.map((cid) => {
          const c = counts[cid] || 0;
          if (!c) return null;
          return <div key={cid} onClick={() => onSelect(active === cid ? null : cid)} title={CLUSTERS[cid].label + ": " + c}
            style={{ width: (c / total) * 100 + "%", background: CLUSTERS[cid].color, cursor: "pointer", opacity: active && active !== cid ? 0.3 : 1, transition: "opacity 0.15s" }} />;
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
        {CLUSTER_ORDER.map((cid) => {
          const c = counts[cid] || 0;
          const m = CLUSTERS[cid];
          return (
            <button key={cid} onClick={() => onSelect(active === cid ? null : cid)}
              style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "3px 0", opacity: active && active !== cid ? 0.45 : 1, transition: "opacity 0.15s" }}>
              <ClusterDot cluster={cid} size={9} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", flex: 1 }}>{m.label}</span>
              <span className="mono tnum" style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>{c}</span>
              <span className="mono tnum" style={{ fontSize: 11, color: "var(--ink-faint)", width: 34, textAlign: "right" }}>{Math.round((c / total) * 100)}%</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LeaderRow({ d, onSelect, onScan }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto auto", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: "var(--r)", transition: "background 0.12s" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <button onClick={() => onSelect(d.id)} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, textAlign: "left", flex: 1 }}>
        <ClusterDot cluster={d.cluster} size={9} ring />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{d.stateCode} · {clusterMeta(d.cluster).short}</div>
        </div>
      </button>
      <Sparkline data={d.trend} w={56} h={24} color={clusterMeta(d.cluster).color} fill />
      <div style={{ textAlign: "right", minWidth: 48 }}>
        <div className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>{(d.reading3 * 100).toFixed(1)}%</div>
        <div className="mono tnum" style={{ fontSize: 10, color: d.yoyReading < 0 ? "var(--bad)" : "var(--ok)", fontWeight: 600 }}>{signed(d.yoyReading * 100, 1)}pp</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onScan && onScan(d.id); }}
        title="Run live scan"
        style={{ padding: "5px 7px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink-3)", display: "flex", alignItems: "center", transition: "border-color 0.12s, color 0.12s", flex: "none" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand)"; e.currentTarget.style.color = "var(--brand)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--ink-3)"; }}>
        <Icon name="flask" size={13} stroke={2} />
      </button>
    </div>
  );
}

function Overview({ onSelectDistrict, goTo, onScan, onAskAI, year }) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const isNarrow = useMediaQuery("(max-width: 980px)");
  const [filter, setFilter] = useState(null);
  const [overview, setOverview] = useState(null);
  const [mapData, setMapData] = useState({ districts: [] });
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getOverview(year), getDistrictsMap(year), getLeaderboard("reading3", "asc", 8, year)])
      .then(([overviewData, mapResponse, leaderResponse]) => {
        if (!alive) return;
        setOverview(overviewData);
        setMapData(mapResponse);
        setLeaderboard(leaderResponse.items || []);
      })
      .catch((err) => alive && setError(err.message || "Failed to load overview"));
    const cleanup = subscribeOverview((event) => setOverview((current) => ({ ...(current || {}), ...event })));
    return () => { alive = false; cleanup(); };
  }, [year]);

  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;
  if (!overview) return <div style={{ padding: 30 }} className="mono">Loading overview...</div>;

  const counts = overview.clusterCounts || {};
  const total = overview.totals.districtsAnalyzed;
  const avgRead = (overview.totals.avgReading3 * 100).toFixed(1);
  const declining = overview.totals.decliningYoyCount;
  const evidenceCount = overview.totals.liveEvidenceCount;
  const dominant = overview.totals.dominantCluster;
  const districts = mapData.districts || [];

  const kpis = [
    { label: "Districts analyzed", value: total, sub: "across 8 states", icon: "map", accent: "var(--brand)" },
    { label: "Avg Grade-3 reading", value: avgRead + "%", sub: "ASER " + year, icon: "trend", accent: "var(--c-infra)" },
    { label: "Declining YoY", value: declining, sub: "of " + total + " districts", accent: "var(--bad)", icon: "pulse" },
    { label: "Dominant cause", value: clusterMeta(dominant).short, sub: counts[dominant] + " districts", accent: clusterMeta(dominant).color, icon: "layers" },
    { label: "Live evidence", value: evidenceCount, sub: "classified items", icon: "evidence", accent: "var(--c-pedagogy)" },
  ];

  return (
    <div className="fade-up" style={{ padding: isMobile ? "18px 14px 34px" : "26px 30px 40px", maxWidth: 1320, margin: "0 auto" }}>
      <PageHeader
        title="District Intelligence"
        sub="Coloured by root cause, not by score — that's the whole point."
        actions={<Button variant="primary" icon="flask" onClick={() => goTo("evidence")}>Run live scan</Button>}
      />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isNarrow ? "repeat(2, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr))", gap: 1, background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: 22 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: "var(--surface)", padding: "16px 18px" }}>
            <Stat {...k} />
          </div>
        ))}
      </div>

      {/* main split */}
      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "minmax(0, 1fr)" : "minmax(0, 1.7fr) minmax(300px, 1fr)", gap: 18, alignItems: "start" }}>
        {/* map */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Cause map</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>choropleth by root cause · marker size ∝ severity</div>
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>HDBSCAN · {total} districts</div>
            </div>
            <ClusterLegend active={filter} onToggle={setFilter} counts={counts} />
          </div>
          <div style={{ height: isMobile ? 420 : 600, background: "oklch(0.11 0.015 235)" }}>
            <DistrictMap districts={districts} selected={null} onSelect={onSelectDistrict} filterCluster={filter} />
          </div>
        </Card>

        {/* right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card>
            <SectionLabel right={<button onClick={() => goTo("clusters")} className="mono" style={{ fontSize: 10.5, color: "var(--brand)", fontWeight: 600 }}>EXPLORE →</button>}>Cause distribution</SectionLabel>
            <DistributionBar counts={counts} total={total} onSelect={setFilter} active={filter} />
          </Card>

          <Card pad={12}>
            <SectionLabel style={{ padding: "4px 6px 0", marginBottom: 6 }}>Lowest performing</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {leaderboard.map((d) => <LeaderRow key={d.id} d={d} onSelect={onSelectDistrict} onScan={onScan} />)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ title, sub, actions }) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  return (
    <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "flex-end", justifyContent: "space-between", gap: isMobile ? 12 : 20, marginBottom: 22, flexDirection: isMobile ? "column" : "row" }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 25, fontWeight: 700, letterSpacing: "-0.03em", overflowWrap: "anywhere" }}>{title}</h1>
        {sub && <p style={{ margin: "5px 0 0", fontSize: 14, color: "var(--ink-3)", maxWidth: 560 }}>{sub}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 10, flex: "none", flexWrap: "wrap", minWidth: 0, width: isMobile ? "100%" : "auto" }}>{actions}</div>}
    </div>
  );
}

export { Overview, PageHeader, ClusterLegend, DistributionBar };
export default Overview;
