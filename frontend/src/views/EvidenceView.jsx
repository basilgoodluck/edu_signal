import { useEffect, useMemo, useState } from "react";
import { getEvidence, getEvidenceSummary, createScan, getScan } from "../api/evidence.js";
import { getDistrictsMap } from "../api/overview.js";
import { subscribeScan } from "../api/streams.js";
import { Button, Card, CLS_STYLE, ClusterDot, Icon, SOURCE_META } from "../components/UI.jsx";
import { PageHeader } from "./OverviewView.jsx";
import { EvidenceClipping } from "./DistrictView.jsx";
import { useMediaQuery } from "../hooks/useMediaQuery.js";
/* EduSignal - Evidence: live scan (Bright Data flow) + global classified feed */

function ScanConsole({ districtId, districtName, onDone, onComplete }) {
  const isNarrow = useMediaQuery("(max-width: 860px)");
  const [scan, setScan] = useState(null);
  const [found, setFound] = useState([]);
  const done = scan?.status === "complete";

  useEffect(() => {
    let cleanup = () => {};
    setScan(null);
    setFound([]);
    createScan({ districtId }).then((created) => {
      setScan(created);
      setFound(created.found || []);
      cleanup = subscribeScan(created.scanId, (event) => {
        if (event.type === "step" && event.step) {
          setScan((current) => {
            const base = current || created;
            return {
              ...base,
              steps: (base.steps || []).map((step) => (
                step.index === event.step.index ? event.step : step
              )),
            };
          });
        } else if (event.type === "evidence" && event.item) {
          setFound((current) => [event.item, ...current]);
        } else if (event.type === "complete" && event.scan) {
          getScan(created.scanId).then((latest) => {
            setScan(latest);
            setFound(latest.found || []);
            onComplete?.();
          }).catch(() => setScan((current) => ({ ...(current || created), ...event.scan })));
        } else if (event.type === "error") {
          setScan((current) => ({ ...(current || created), status: "failed", message: event.message }));
        } else {
          setScan((current) => ({ ...(current || created), ...event }));
          if (event.found) setFound(event.found);
        }
      });
    }).catch(() => {
      setScan({ status: "error", steps: [] });
    });
    return () => cleanup();
  }, [districtId]);

  const steps = scan?.steps || [];

  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "13px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: done ? "var(--ok)" : "var(--c-migration)", animation: done ? "none" : "pulse 1s infinite" }} />
          <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{done ? "SCAN COMPLETE" : "SCANNING"} - {districtName || "district"}</span>
        </div>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>Bright Data - Web Unlocker + SERP</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1.1fr)", gap: 0 }}>
        <div style={{ padding: "14px 16px", borderRight: isNarrow ? "none" : "1px solid var(--border)", borderBottom: isNarrow ? "1px solid var(--border)" : "none", background: "var(--bg-sunken)", minHeight: isNarrow ? 0 : 320 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {steps.length === 0 && <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Starting scan...</div>}
            {steps.map((s, i) => {
              const state = ["complete", "done"].includes(s.status) ? "done" : ["running", "run"].includes(s.status) ? "run" : "wait";
              return (
                <div key={s.index ?? i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, opacity: state === "wait" ? 0.4 : 1, background: state === "run" ? "var(--surface)" : "transparent", transition: "opacity 0.3s" }}>
                  <span style={{ width: 15, flex: "none", display: "flex", justifyContent: "center" }}>
                    {state === "done" ? <Icon name="check" size={14} stroke={2.4} style={{ color: "var(--ok)" }} />
                      : state === "run" ? <span style={{ width: 12, height: 12, border: "2px solid var(--c-migration)", borderTopColor: "transparent", borderRadius: 99, animation: "spin 0.7s linear infinite", display: "block" }} />
                      : <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--ink-faint)" }} />}
                  </span>
                  <span className="mono" style={{ fontSize: 11.5, color: state === "wait" ? "var(--ink-3)" : "var(--ink)", fontWeight: state === "run" ? 600 : 400 }}>{s.label}</span>
                </div>
              );
            })}
          </div>
          {done && (
            <Button variant="primary" size="sm" icon="arrow" style={{ marginTop: 16 }} onClick={() => onDone(districtId)}>
              View results
            </Button>
          )}
        </div>

        <div style={{ padding: "14px 16px", maxHeight: 380, overflow: "auto" }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--ink-faint)", marginBottom: 10 }}>EVIDENCE CAPTURED &amp; CLASSIFIED</div>
          {found.length === 0 && <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Awaiting classification pass...</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {found.map((ev, i) => (
              <div key={ev.id} className="fade-up" style={{ animationDelay: i * 0.12 + "s" }}>
                <EvidenceClipping ev={ev} compact />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function EvidenceView({ scanTarget, onSelectDistrict }) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const [scanning, setScanning] = useState(!!scanTarget);
  const [target, setTarget] = useState(scanTarget || "");
  const [clsFilter, setClsFilter] = useState(null);
  const [srcFilter, setSrcFilter] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [feed, setFeed] = useState([]);
  const [summary, setSummary] = useState({ classificationCounts: {}, sourceMeta: SOURCE_META });
  const [error, setError] = useState(null);

  useEffect(() => { if (scanTarget) { setTarget(scanTarget); setScanning(true); } }, [scanTarget]);
  useEffect(() => {
    Promise.all([getDistrictsMap(), getEvidenceSummary()])
      .then(([mapResponse, summaryResponse]) => {
        const loadedDistricts = mapResponse.districts || [];
        setDistricts(loadedDistricts);
        setTarget((current) => current || loadedDistricts[0]?.id || "");
        setSummary(summaryResponse);
      })
      .catch((err) => setError(err.message || "Failed to load evidence"));
  }, []);

  useEffect(() => {
    if (!target) return;
    getEvidence({ districtId: target, limit: 50 })
      .then((r) => setFeed(r.items || []))
      .catch(() => setFeed([]));
  }, [target]);

  function refreshEvidence() {
    if (!target) return;
    Promise.all([getEvidence({ districtId: target, limit: 50 }), getEvidenceSummary()])
      .then(([evidenceResponse, summaryResponse]) => {
        setFeed(evidenceResponse.items || []);
        setSummary(summaryResponse);
      })
      .catch(() => null);
  }

  const filtered = useMemo(() => feed.filter((e) => (!clsFilter || e.classification === clsFilter) && (!srcFilter || e.sourceType === srcFilter)), [feed, clsFilter, srcFilter]);
  const clsCounts = summary.classificationCounts || {};
  const sourceMeta = summary.sourceMeta || SOURCE_META;
  const targetDistrict = districts.find((d) => d.id === target);

  if (error) return <div style={{ padding: 30 }} className="mono">{error}</div>;

  return (
    <div className="fade-up" style={{ padding: isMobile ? "18px 14px 34px" : "26px 30px 48px", maxWidth: 1320, margin: "0 auto" }}>
      <PageHeader
        title="Evidence Engine"
        sub="Every classification shows the raw scraped source first, the verdict second. Nothing is a black box."
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
            <select value={target} onChange={(e) => setTarget(e.target.value)}
              style={{ fontFamily: "var(--mono)", fontSize: 12.5, padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600 }}>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <Button variant="primary" icon="flask" onClick={() => target && setScanning(true)}>Run live scan</Button>
          </div>
        }
      />

      {scanning && target && (
        <div style={{ marginBottom: 24 }}>
          <ScanConsole districtId={target} districtName={targetDistrict?.name} onComplete={refreshEvidence} onDone={(id) => { setScanning(false); onSelectDistrict(id); }} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginRight: 4 }}>{filtered.length} ITEMS</div>
        {["Supporting", "Contradicting", "Irrelevant"].map((c) => {
          const s = CLS_STYLE[c]; const on = clsFilter === c;
          return (
            <button key={c} onClick={() => setClsFilter(on ? null : c)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 99, fontSize: 11.5, fontWeight: 600, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.02em",
                border: `1px solid ${on ? s.color : "var(--border)"}`, background: on ? s.tint : "var(--surface)", color: on ? s.color : "var(--ink-2)" }}>
              {s.glyph} {c} <span style={{ opacity: 0.7 }}>{clsCounts[c] || 0}</span>
            </button>
          );
        })}
        <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
        {Object.keys(sourceMeta).map((sk) => {
          const on = srcFilter === sk;
          return (
            <button key={sk} onClick={() => setSrcFilter(on ? null : sk)}
              style={{ padding: "5px 10px", borderRadius: 99, fontSize: 10.5, fontWeight: 600, fontFamily: "var(--mono)", letterSpacing: "0.04em",
                border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`, background: on ? "var(--brand-tint)" : "var(--surface)", color: on ? "var(--brand)" : "var(--ink-3)" }}>
              {sourceMeta[sk].icon} {sourceMeta[sk].label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "min(100%, 260px)" : "330px"}, 1fr))`, gap: 14 }}>
        {filtered.map((ev, i) => (
          <div key={ev.districtId + ev.id} className="fade-up" style={{ animationDelay: Math.min(i * 0.03, 0.4) + "s" }}>
            <button onClick={() => onSelectDistrict(ev.districtId)} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--ink-2)", maxWidth: "100%" }}>
                <ClusterDot cluster={ev.cluster} size={8} />{ev.districtName}
                <Icon name="arrow" size={12} stroke={2} style={{ color: "var(--ink-faint)" }} />
              </span>
            </button>
            <EvidenceClipping ev={ev} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

export { EvidenceView, ScanConsole };
export default EvidenceView;
