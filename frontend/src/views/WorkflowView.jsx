import { useEffect, useState } from "react";
import { getDistrictsMap } from "../api/overview.js";
import { getAlerts, getComparison, getPeerNetwork, getTracker } from "../api/workflow.js";
import { subscribeAlerts, subscribeTracker } from "../api/streams.js";
import { Card, ClusterBadge, ClusterDot, Icon, SectionLabel, Stat, signed } from "../components/UI.jsx";
import { PeerNetwork, setChartData } from "../components/Charts.jsx";
import { PageHeader } from "./OverviewView.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
/* EduSignal - Peers & Interventions, Tracker, Alerts */

function PeersView({ anchorId, onSelectDistrict }) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [anchor, setAnchor] = useState(anchorId || "");
  const [districts, setDistricts] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { if (anchorId) setAnchor(anchorId); }, [anchorId]);
  useEffect(() => {
    Promise.all([getDistrictsMap(), getPeerNetwork(anchor || undefined)])
      .then(([mapResponse, network]) => {
        const loaded = mapResponse.districts || [];
        setDistricts(loaded);
        setChartData((network.nodes || loaded).map((node) => ({ ...node, state: node.state || "", stateCode: node.stateCode || "", confidence: node.confidence || 0.7 })));
        setAnchor((current) => current || loaded[0]?.id || "");
      })
      .catch((err) => setError(err.message || "Failed to load peers"));
  }, [anchor]);
  useEffect(() => {
    if (!anchor) return;
    getComparison(anchor).then(setComparison).catch((err) => setError(err.message || "Failed to load comparison"));
  }, [anchor]);

  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;
  if (!anchor || !comparison) return <div style={{ padding: 30 }} className="mono">Loading peers...</div>;

  const group = comparison.group || [];
  const anchorDistrict = group.find((item) => item.id === anchor) || group[0];
  const interventions = comparison.interventions || [];

  return (
    <div className="fade-up" style={{ padding: isMobile ? "18px 14px 34px" : "26px 30px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <PageHeader
        title="Peers & Interventions"
        sub="Same root cause, different outcomes. Borrow what worked next door."
        actions={
          <select value={anchor} onChange={(e) => setAnchor(e.target.value)}
            style={{ fontFamily: "var(--mono)", fontSize: 12.5, padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600 }}>
            {districts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <ClusterBadge cluster={anchorDistrict.cluster} />
        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{group.length} districts share this cause</span>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)", padding: "18px 20px", marginBottom: 18 }}>
        <SectionLabel right={<span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>force-directed - click a node</span>}>Intervention-transfer network</SectionLabel>
        <PeerNetwork anchorId={anchor} onSelect={onSelectDistrict} height={420} />
      </div>

      <Card pad={0} style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 600 }}>Metric</th>
                {group.map((g) => <th key={g.id} style={{ padding: "12px 16px", minWidth: 120, textAlign: "left" }}>{g.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {(comparison.metrics || []).map((met) => (
                <tr key={met.key} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "11px 16px", fontSize: 12.5, color: "var(--ink-2)", fontWeight: 500 }}>{met.label}</td>
                  {group.map((g) => <td key={g.id} className="mono tnum" style={{ padding: "11px 16px", fontSize: 13, fontWeight: 500 }}>{met.key === "vacancyRate" ? Math.round((g[met.key] || 0) * 100) + "%" : g[met.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionLabel>Proven interventions</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "min(100%, 260px)" : "300px"}, 1fr))`, gap: 14 }}>
        {interventions.map((iv) => (
          <Card key={iv.id || iv.type} hover>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{iv.type}</div>
              <div className="mono tnum" style={{ fontSize: 20, fontWeight: 700, color: "var(--ok)" }}>{signed(iv.aserDelta || 0)}</div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{iv.blurb}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TrackerView({ onSelectDistrict }) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    getTracker().then(setData).catch((err) => setError(err.message || "Failed to load tracker"));
    return subscribeTracker((event) => {
      if (event.item) {
        setData((current) => {
          const items = [event.item, ...((current?.items || []).filter((item) => item.id !== event.item.id))];
          return {
            ...(current || {}),
            items,
            summary: {
              active: items.filter((item) => item.status === "active").length,
              cumulativeLift: items.reduce((sum, item) => sum + ((item.latest || 0) - (item.baseline || 0)), 0),
              districtsCovered: new Set(items.map((item) => item.district)).size,
            },
          };
        });
      }
    });
  }, []);

  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;
  if (!data) return <div style={{ padding: 30 }} className="mono">Loading tracker...</div>;

  const summary = data.summary || {};
  const items = data.items || [];

  return (
    <div className="fade-up" style={{ padding: isMobile ? "18px 14px 34px" : "26px 30px 48px", maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader title="Intervention Tracker" sub="Interventions you've launched, and whether outcomes are moving." />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 1, background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: 22 }}>
        <div style={{ background: "var(--surface)", padding: "16px 18px" }}><Stat label="Live interventions" value={summary.active || 0} sub="being tracked" icon="flask" /></div>
        <div style={{ background: "var(--surface)", padding: "16px 18px" }}><Stat label="Cumulative lift" value={signed(summary.cumulativeLift || 0, 0) + "pp"} sub="reading, since baseline" accent="var(--ok)" icon="trend" /></div>
        <div style={{ background: "var(--surface)", padding: "16px 18px" }}><Stat label="Districts covered" value={summary.districtsCovered || 0} sub="under active programs" icon="pin" /></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((t) => (
          <Card key={t.id}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <button onClick={() => onSelectDistrict(t.district)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 5 }}>
                  <ClusterDot cluster={t.cluster} size={8} />{t.districtName || t.district}
                </button>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{t.type}</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>{t.note}</p>
              </div>
              <div className="mono tnum" style={{ fontSize: 13, fontWeight: 700, color: "var(--ok)" }}>{t.latest}% / {t.target}%</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AlertsView({ onSelectDistrict }) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);
  const levelMeta = {
    high: { c: "var(--bad)", t: "var(--bad-tint)", label: "High" },
    medium: { c: "var(--c-migration)", t: "var(--c-migration-tint)", label: "Medium" },
    low: { c: "var(--ink-3)", t: "var(--neutral-tint)", label: "Low" },
  };
  useEffect(() => {
    getAlerts().then((response) => setAlerts(response.items || [])).catch((err) => setError(err.message || "Failed to load alerts"));
    return subscribeAlerts((event) => {
      if (event.alert) {
        setAlerts((current) => {
          const remaining = (current || []).filter((item) => item.id !== event.alert.id);
          return event.alert.status && event.alert.status !== "open" ? remaining : [event.alert, ...remaining];
        });
      }
    });
  }, []);

  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;
  if (!alerts) return <div style={{ padding: 30 }} className="mono">Loading alerts...</div>;

  return (
    <div className="fade-up" style={{ padding: isMobile ? "18px 14px 34px" : "26px 30px 48px", maxWidth: 900, margin: "0 auto" }}>
      <PageHeader title="Alerts" sub="Time-sensitive signals - act before the window closes, not after." />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {alerts.map((a) => {
          const lm = levelMeta[a.level] || levelMeta.low;
          return (
            <Card key={a.id} hover onClick={() => onSelectDistrict(a.district)} style={{ display: "flex", gap: 16, alignItems: "flex-start", minWidth: 0 }}>
              <div style={{ width: 4, alignSelf: "stretch", borderRadius: 99, background: lm.c, flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ padding: "3px 9px", borderRadius: 99, fontSize: 10, fontWeight: 600, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.05em", background: lm.t, color: lm.c }}>{lm.label}</span>
                  <ClusterBadge cluster={a.cluster} size="sm" />
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginLeft: "auto" }}>{a.when}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 4 }}>{a.title}</div>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{a.body}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                  <ClusterDot cluster={a.cluster} size={8} />
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>{a.district}</span>
                  <Icon name="arrow" size={13} stroke={2} style={{ color: "var(--ink-faint)" }} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export { PeersView, TrackerView, AlertsView };
export default PeersView;
