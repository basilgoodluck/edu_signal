import { useEffect, useState } from "react";
import { getDistrict, getDistrictEvidence, getDistrictInterventions, getDistrictPeers, startDistrictScan } from "../api/districts.js";
import { Button, Card, ClassificationBadge, CLS_STYLE, ClusterBadge, ClusterDot, ConfidencePill, FEATURE_LABELS, Icon, SectionLabel, ShapWaterfall, SourceTag, clusterMeta, signed } from "../components/UI.jsx";
import { RadarChart, TrendChart, setChartData } from "../components/Charts.jsx";
/* EduSignal — District detail (the demo hero) + reusable EvidenceClipping */

function EvidenceClipping({ ev, compact }) {
  const [open, setOpen] = useState(false);
  const s = CLS_STYLE[ev.classification] || CLS_STYLE.Irrelevant;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)",
      overflow: "hidden", position: "relative",
    }}>
      {/* scraped meta header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 13px", background: "var(--surface-2)", borderBottom: "1px dashed var(--border-strong)" }}>
        <SourceTag sourceType={ev.sourceType} />
        <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>{ev.date}</span>
      </div>
      {/* raw clipping */}
      <div style={{ padding: compact ? "13px 15px" : "16px 17px" }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--ink-faint)", marginBottom: 7 }}>RAW SOURCE</div>
        <div style={{ display: "flex", gap: 9 }}>
          <span style={{ fontSize: 24, lineHeight: 0.8, color: s.color, fontWeight: 700, flex: "none" }}>“</span>
          <p style={{ margin: 0, fontSize: compact ? 14 : 15, lineHeight: 1.5, color: "var(--ink)", fontWeight: 500, letterSpacing: "-0.01em" }}>{ev.raw}</p>
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 9, marginLeft: 18 }}>— {ev.source}</div>

        {/* classification verdict */}
        <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <ClassificationBadge value={ev.classification} />
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.45, flex: 1 }}>{ev.reason}</p>
        </div>
        {!compact && (
          <button onClick={() => setOpen(!open)} className="mono" style={{ fontSize: 10.5, color: "var(--brand)", fontWeight: 600, marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5 }}>
            View source <Icon name="ext" size={11} stroke={2} />
          </button>
        )}
      </div>
    </div>
  );
}

function FeatureTable({ d }) {
  const rows = [
    { k: "reading3", v: (d.reading3 * 100).toFixed(1) + "%" }, { k: "arith5", v: (d.arith5 * 100).toFixed(1) + "%" },
    { k: "yoyReading", v: signed(d.yoyReading * 100, 1) + "pp", bad: d.yoyReading < 0 },
    { k: "ptr", v: d.ptr + ":1", bad: d.ptr > 35 },
    { k: "vacancyRate", v: Math.round(d.vacancyRate * 100) + "%", bad: d.vacancyRate > 0.2 },
    { k: "ndviVar", v: d.ndviVar.toFixed(2) },
    { k: "floodDays", v: d.floodDays + "d", bad: d.floodDays > 30 },
    { k: "vacancyPosts", v: d.vacancyPosts },
    { k: "newsMigration", v: d.newsMigration.toFixed(2) },
    { k: "forumComplaints", v: d.forumComplaints },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
      {rows.map((r) => (
        <div key={r.k} style={{ background: "var(--surface)", padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{FEATURE_LABELS[r.k]}</span>
          <span className="mono tnum" style={{ fontSize: 12.5, fontWeight: 600, color: r.bad ? "var(--bad)" : "var(--ink)" }}>{r.v}</span>
        </div>
      ))}
    </div>
  );
}

function PeerChip({ id, peerMap = {}, onSelect, accent }) {
  const p = peerMap[id];
  if (!p) return null;
  return (
    <button onClick={() => onSelect(id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--surface)", width: "100%", textAlign: "left", transition: "border-color 0.13s, background 0.13s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = "var(--surface-2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
      <ClusterDot cluster={p.cluster} size={9} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{p.stateCode}</div>
      </div>
      <span className="mono tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>{p.reading3}%</span>
      <Icon name="arrow" size={14} stroke={2} style={{ color: "var(--ink-faint)" }} />
    </button>
  );
}

function DistrictDetail({ id, onSelectDistrict, goTo, onScan, onAskAI }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!id) return;
    Promise.all([getDistrict(id), getDistrictEvidence(id), getDistrictPeers(id), getDistrictInterventions(id)])
      .then(([detailData, evidenceData, peersData, interventionsData]) => {
        setDetail({
          ...detailData,
          district: { ...detailData.district, evidence: evidenceData.items || [], peers: (peersData || []).map((p) => p.id) },
          peers: peersData || [],
          interventions: interventionsData || [],
        });
        setChartData([detailData.district, ...(peersData || [])]);
      })
      .catch((err) => setError(err.message || "Failed to load district"));
  }, [id]);
  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;
  if (!detail) return <div style={{ padding: 30 }} className="mono">Loading district...</div>;
  const d = detail.district;
  const m = clusterMeta(d.cluster);
  const interventions = detail.interventions || [];
  const peerMap = Object.fromEntries((detail.peers || []).map((p) => [p.id, p]));
  const supporting = d.evidence.filter((e) => e.classification === "Supporting").length;
  const contra = d.evidence.filter((e) => e.classification === "Contradicting").length;

  return (
    <div className="fade-up" style={{ padding: "20px 30px 48px", maxWidth: 1320, margin: "0 auto" }}>
      {/* breadcrumb */}
      <button onClick={() => goTo("overview")} className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600, marginBottom: 16 }}>
        <Icon name="back" size={14} stroke={2} /> ALL DISTRICTS
      </button>

      {/* hero verdict */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>{d.name}</h1>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", padding: "3px 9px", border: "1px solid var(--border)", borderRadius: 99 }}>{d.state}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <ClusterBadge cluster={d.cluster} />
            <ConfidencePill value={d.confidence} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onAskAI && <Button variant="subtle" icon="spark" onClick={onAskAI}>Ask AI</Button>}
          <Button variant="primary" icon="flask" onClick={() => onScan(d.id)}>Run live scan</Button>
        </div>
      </div>

      {/* verdict explainer band */}
      <div style={{ background: m.tint, border: `1px solid ${m.color}`, borderColor: "color-mix(in oklch, " + "var(--border)" + ", transparent)", borderRadius: "var(--r-lg)", padding: "18px 20px", marginBottom: 22, display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 300 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: m.color, fontWeight: 600, marginBottom: 6 }}>WHY THIS CLUSTER</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--ink)", maxWidth: 620 }}>{m.blurb}</p>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: m.color, fontWeight: 600, marginBottom: 8 }}>SIGNATURE · {m.window}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
            {m.signature.map((s) => (
              <li key={s} style={{ fontSize: 12.5, color: "var(--ink-2)", display: "flex", gap: 7 }}>
                <span style={{ color: m.color }}>›</span>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 1fr)", gap: 18, alignItems: "start" }}>
        {/* left: evidence */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionLabel right={
            <span style={{ display: "flex", gap: 8 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ok)", fontWeight: 600 }}>{supporting} SUPPORTING</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--bad)", fontWeight: 600 }}>{contra} CONTRADICTING</span>
            </span>
          }>Evidence trail · raw source first</SectionLabel>
          {d.evidence.length === 0 && (
            <Card style={{ textAlign: "center", padding: "32px" }}>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>No cached evidence for this district yet.</div>
              <Button variant="subtle" icon="flask" size="sm" style={{ marginTop: 14, margin: "14px auto 0" }} onClick={() => onScan(d.id)}>Run live scan to populate</Button>
            </Card>
          )}
          {d.evidence.map((ev) => <EvidenceClipping key={ev.id} ev={ev} />)}
        </div>

        {/* right: model + trend + peers + interventions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card>
            <SectionLabel>SHAP — why the model decided</SectionLabel>
            <ShapWaterfall shap={d.shap} cluster={d.cluster} />
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 12, lineHeight: 1.5 }}>Bars right of centre pushed {d.name} <span style={{ color: m.color }}>into</span> the {m.short.toLowerCase()} cluster; left bars pushed against it.</div>
          </Card>

          <Card>
            <SectionLabel right={<span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>vs cluster / national</span>}>Capability radar</SectionLabel>
            <RadarChart districtId={d.id} height={290} />
          </Card>

          <Card>
            <SectionLabel right={<span className="mono" style={{ fontSize: 10.5, color: d.yoyReading < 0 ? "var(--bad)" : "var(--ok)", fontWeight: 600 }}>{signed(d.yoyReading)} YoY</span>}>Reading vs arithmetic · 2018–2023</SectionLabel>
            <TrendChart district={d} height={210} />
          </Card>

          <Card>
            <SectionLabel right={<button onClick={() => goTo("peers")} className="mono" style={{ fontSize: 10.5, color: "var(--brand)", fontWeight: 600 }}>COMPARE →</button>}>Peer districts</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.peers.length ? d.peers.map((pid) => <PeerChip key={pid} id={pid} peerMap={peerMap} onSelect={onSelectDistrict} />) : <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>No clean peer group — district flagged as noise.</div>}
            </div>
          </Card>

          <Card>
            <SectionLabel>Feature vector</SectionLabel>
            <FeatureTable d={d} />
          </Card>

          {interventions.length > 0 && (
            <Card style={{ background: "var(--surface-2)" }}>
              <SectionLabel right={<button onClick={() => goTo("peers")} className="mono" style={{ fontSize: 10.5, color: "var(--brand)", fontWeight: 600 }}>ALL →</button>}>What worked in peers</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {interventions.slice(0, 2).map((iv) => (
                  <div key={iv.type} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{iv.type}</div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{iv.districts.join(", ")}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono tnum" style={{ fontSize: 15, fontWeight: 700, color: "var(--ok)" }}>{signed(iv.aserDelta)}</div>
                      <div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)" }}>ASER Δ</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export { DistrictDetail, EvidenceClipping, FeatureTable, PeerChip };
export default DistrictDetail;
