import { useEffect, useState } from "react";
import { getClusters } from "../api/clusters.js";
import { Card, ClusterDot, signed } from "../components/UI.jsx";
import { PageHeader } from "./OverviewView.jsx";
/* EduSignal â€” Clusters explorer */

function ClusterCard({ item, onSelectDistrict, goTo }) {
  const cid = item.cluster.id;
  const m = item.cluster;
  const districts = item.districts || [];
  const avg = Math.round(item.avgReading3 || 0);
  const bestIv = item.bestIntervention;

  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ height: 4, background: m.color }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: m.tint, display: "grid", placeItems: "center" }}>
              <ClusterDot cluster={cid} size={12} />
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>{m.label}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{m.window}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="tnum" style={{ fontSize: 22, fontWeight: 700 }}>{districts.length}</div>
            <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-faint)" }}>DISTRICTS</div>
          </div>
        </div>

        <p style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.5, color: "var(--ink-2)" }}>{m.blurb}</p>

        <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "var(--ink-faint)", marginBottom: 8 }}>SIGNATURE</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {m.signature.map((s) => (
            <span key={s} style={{ fontSize: 11, padding: "4px 9px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink-2)" }}>{s}</span>
          ))}
        </div>

        {cid !== "noise" && (
          <div style={{ display: "flex", gap: 14, padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: bestIv ? "1px solid var(--border)" : "none", marginBottom: bestIv ? 14 : 0 }}>
            <div><div className="tnum" style={{ fontSize: 18, fontWeight: 600 }}>{avg}%</div><div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)" }}>AVG READING</div></div>
            {bestIv && <div><div className="tnum" style={{ fontSize: 18, fontWeight: 600, color: "var(--ok)" }}>{signed(bestIv.aserDelta)}</div><div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)" }}>BEST FIX</div></div>}
          </div>
        )}

        {/* district chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {districts.map((d) => (
            <button key={d.id} onClick={() => onSelectDistrict(d.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 99, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 11.5, fontWeight: 600, color: "var(--ink)", transition: "border-color 0.12s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = m.color)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
              {d.name} <span className="mono tnum" style={{ fontSize: 10, color: "var(--ink-3)" }}>{d.reading3}%</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ClustersView({ onSelectDistrict, goTo }) {
  const [clusters, setClusters] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    getClusters()
      .then((response) => setClusters(response.items || []))
      .catch((err) => setError(err.message || "Failed to load clusters"));
  }, []);

  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;
  if (!clusters) return <div style={{ padding: 30 }} className="mono">Loading clusters...</div>;

  return (
    <div className="fade-up" style={{ padding: "26px 30px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <PageHeader
        title="Cause Clusters"
        sub="Five archetypes discovered by HDBSCAN. Districts that fit nothing are kept as noise â€” never force-fit."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 18 }}>
        {clusters.map((item) => <ClusterCard key={item.cluster.id} item={item} onSelectDistrict={onSelectDistrict} goTo={goTo} />)}
      </div>
    </div>
  );
}

export { ClustersView, ClusterCard };
export default ClustersView;
