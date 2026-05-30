/* EduSignal — app shell: sidebar, topbar, command palette, routing */
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import config from "./config.js";
import { getBootstrap, getMe, getNavSummary } from "./api/shell.js";
import { subscribeAppSummary } from "./api/streams.js";
import { ClusterBadge, ClusterDot, Icon, CLUSTER_ORDER, CLUSTERS, clusterMeta } from "./components/UI.jsx";
import LoginView from "./views/LoginView.jsx";
import Overview from "./views/OverviewView.jsx";
import SignalLab from "./views/AnalyticsView.jsx";
import PipelineView from "./views/PipelineView.jsx";
import DistrictDetail from "./views/DistrictView.jsx";
import EvidenceView from "./views/EvidenceView.jsx";
import ClustersView from "./views/ClustersView.jsx";
import { AlertsView, PeersView, TrackerView } from "./views/WorkflowView.jsx";
import AIPanel from "./views/AIView.jsx";
import LandingPage from "./views/LandingPage.jsx";
import { useMediaQuery } from "./hooks/useMediaQuery.js";

const NAV = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "lab", label: "Signal Lab", icon: "spark" },
  { id: "pipeline", label: "Data Pipeline", icon: "pipeline" },
  { id: "clusters", label: "Cause Clusters", icon: "layers" },
  { id: "evidence", label: "Evidence Engine", icon: "evidence" },
  { id: "peers", label: "Peers & Fixes", icon: "flask" },
  { id: "tracker", label: "Tracker", icon: "pulse" },
  { id: "alerts", label: "Alerts", icon: "bell" },
];

const PATH_BY_VIEW = {
  overview: "/dashboard",
  lab: "/lab",
  pipeline: "/pipeline",
  clusters: "/clusters",
  evidence: "/evidence",
  peers: "/peers",
  tracker: "/tracker",
  alerts: "/alerts",
};

function routeFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "district" && parts[1]) return { view: "district", id: parts[1] };
  if (pathname === "/dashboard") return { view: "overview", id: null };
  const match = Object.entries(PATH_BY_VIEW).find(([, path]) => path === pathname);
  return { view: match ? match[0] : "overview", id: null };
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--brand)", display: "grid", placeItems: "center", boxShadow: "var(--shadow-sm)", position: "relative", overflow: "hidden" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l5-6 4 3 5-8" /><circle cx="8" cy="11" r="1.4" fill="#fff" stroke="none" /><circle cx="12" cy="14" r="1.4" fill="#fff" stroke="none" /><circle cx="17" cy="6" r="1.4" fill="#fff" stroke="none" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>EduSignal</div>
        <div className="mono" style={{ fontSize: 8.5, letterSpacing: "0.14em", color: "var(--ink-faint)", marginTop: 2 }}>ROOT-CAUSE INTEL</div>
      </div>
    </div>
  );
}

function Sidebar({ route, onNav, onOpenCmd, user, summary, onLogout }) {
  const counts = summary?.clusterCounts || {};
  const alertCount = summary?.highAlertCount || 0;
  return (
    <aside style={{ width: "var(--sidebar-w)", flex: "none", borderRight: "1px solid var(--border)", background: "var(--surface)", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "18px 18px 14px", background: "linear-gradient(180deg, color-mix(in oklch, var(--brand), transparent 80%), transparent)" }}><Logo /></div>

      <div style={{ padding: "0 14px 14px" }}>
        <button onClick={onOpenCmd} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 11px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--surface-2)", color: "var(--ink-3)", fontSize: 12.5, transition: "border-color 0.13s" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}>
          <Icon name="search" size={15} stroke={2} />
          <span style={{ flex: 1, textAlign: "left" }}>Search districts…</span>
          <span className="mono" style={{ fontSize: 10, padding: "1px 5px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)" }}>⌘K</span>
        </button>
      </div>

      <nav style={{ flex: 1, padding: "4px 12px", overflowY: "auto" }}>
        {NAV.map((n) => {
          const on = route.view === n.id;
          return (
            <button key={n.id} onClick={() => onNav(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 11px", borderRadius: "var(--r-sm)", marginBottom: 2, fontSize: 13.5, fontWeight: on ? 600 : 500,
                color: on ? "var(--brand)" : "var(--ink-2)", background: on ? "var(--brand-tint)" : "transparent", transition: "background 0.12s, color 0.12s", position: "relative" }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
              <Icon name={n.icon} size={17} stroke={on ? 2.1 : 1.8} />
              <span style={{ flex: 1, textAlign: "left" }}>{n.label}</span>
              {n.id === "alerts" && alertCount > 0 && (
                <span className="mono tnum" style={{ fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, padding: "0 5px", borderRadius: 99, background: "var(--bad)", color: "#fff", display: "grid", placeItems: "center" }}>{alertCount}</span>
              )}
            </button>
          );
        })}

        <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--ink-faint)", padding: "18px 11px 8px" }}>CAUSE CLUSTERS</div>
        {CLUSTER_ORDER.filter((c) => c !== "noise").map((cid) => {
          const m = CLUSTERS[cid];
          return (
            <button key={cid} onClick={() => onNav("clusters")}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "7px 11px", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--ink-2)", transition: "background 0.12s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <ClusterDot cluster={cid} size={9} />
              <span style={{ flex: 1, textAlign: "left" }}>{m.short}</span>
              <span className="mono tnum" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{counts[cid] || 0}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 99, background: "linear-gradient(135deg, var(--c-language), var(--brand))", display: "grid", placeItems: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{user.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
          <div className="mono" style={{ fontSize: 9.5, color: "var(--ink-faint)" }}>{user.role}</div>
        </div>
        <button onClick={onLogout} title="Logout" style={{ color: "var(--ink-3)", padding: 4 }}><Icon name="close" size={14} /></button>
      </div>
    </aside>
  );
}

function Topbar({ route, districtName, pipeline, onMenu, isMobile }) {
  const labels = { overview: "Overview", lab: "Signal Lab", pipeline: "Data Pipeline", clusters: "Cause Clusters", evidence: "Evidence Engine", peers: "Peers & Fixes", tracker: "Tracker", alerts: "Alerts", district: "District" };
  return (
    <div style={{ minHeight: 52, borderBottom: "1px solid var(--border)", background: "color-mix(in oklch, var(--surface), transparent 5%)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: isMobile ? "0 14px" : "0 30px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, minWidth: 0 }}>
        {isMobile && (
          <button onClick={onMenu} title="Open navigation" style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--surface-2)", display: "grid", placeItems: "center", flex: "none" }}>
            <Icon name="layers" size={16} stroke={2} />
          </button>
        )}
        <span className="mono" style={{ color: "var(--brand)", letterSpacing: "0.04em", fontWeight: 600 }}>EduSignal</span>
        <span style={{ color: "var(--ink-faint)" }}>/</span>
        <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route.view === "district" ? districtName || "District" : labels[route.view]}</span>
      </div>
      {!isMobile && <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ink-3)" }} className="mono">
          <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--ok)", animation: "pulse 2s infinite" }} />
          {(pipeline?.label || "PIPELINE LIVE").toUpperCase()}
        </span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>ASER 2023 · UDISE+ 2023-24</span>
      </div>}
    </div>
  );
}

function CommandPalette({ open, onClose, onSelectDistrict, onNav, districts }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);
  if (!open) return null;
  const ql = q.toLowerCase();
  const ds = districts.filter((d) => d.name.toLowerCase().includes(ql) || d.state.toLowerCase().includes(ql) || clusterMeta(d.cluster).label.toLowerCase().includes(ql));
  const navs = NAV.filter((n) => n.label.toLowerCase().includes(ql));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "oklch(0.08 0.01 235 / 0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", animation: "fadeIn 0.14s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(580px, 92vw)", background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-lg)", overflow: "hidden", animation: "fadeUp 0.18s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
          <Icon name="search" size={18} style={{ color: "var(--ink-3)" }} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search districts, causes, views…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "var(--sans)", background: "transparent", color: "var(--ink)" }} />
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4 }}>ESC</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: 8 }}>
          {navs.length > 0 && <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--ink-faint)", padding: "8px 10px 4px" }}>VIEWS</div>}
          {navs.map((n) => (
            <button key={n.id} onClick={() => { onNav(n.id); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 11px", borderRadius: "var(--r-sm)", fontSize: 13.5, color: "var(--ink)", transition: "background 0.1s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <Icon name={n.icon} size={16} style={{ color: "var(--ink-3)" }} />{n.label}
            </button>
          ))}
          {ds.length > 0 && <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--ink-faint)", padding: "10px 10px 4px" }}>DISTRICTS · {ds.length}</div>}
          {ds.map((d) => (
            <button key={d.id} onClick={() => { onSelectDistrict(d.id); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 11px", borderRadius: "var(--r-sm)", transition: "background 0.1s", textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <ClusterDot cluster={d.cluster} size={9} ring />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{d.name}<span style={{ color: "var(--ink-faint)", fontWeight: 400 }}> · {d.state}</span></span>
              <ClusterBadge cluster={d.cluster} size="sm" />
            </button>
          ))}
          {ds.length === 0 && navs.length === 0 && <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "var(--ink-3)" }} className="mono">No matches for "{q}"</div>}
        </div>
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(() => routeFromPath(location.pathname), [location.pathname]);
  const [scanTarget, setScanTarget] = useState(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 820px)");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(config.auth.tokenKey)); } catch { return null; }
  });
  const [summary, setSummary] = useState(null);
  const [bootstrap, setBootstrap] = useState({ districts: [], clusters: CLUSTERS, clusterOrder: CLUSTER_ORDER });
  const appRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    appRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!user) return;
    getMe().catch(() => null);
    getNavSummary().then(setSummary).catch(() => setSummary({ highAlertCount: 0, clusterCounts: {}, pipeline: { label: "Pipeline live" } }));
    getBootstrap().then(setBootstrap).catch(() => null);
    return subscribeAppSummary((event) => {
      setSummary((current) => ({ ...(current || {}), ...event }));
    });
  }, [user]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [location.pathname]);

  const goTo = (view) => { setScanTarget(null); setNavOpen(false); navigate(PATH_BY_VIEW[view] || "/"); };
  const selectDistrict = (id) => { setScanTarget(null); setNavOpen(false); navigate(`/district/${id}`); };
  const runScan = (id) => { setScanTarget(id); navigate("/evidence"); };
  const openAI = (districtId) => { if (districtId) selectDistrict(districtId); setAiOpen(true); };
  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((o) => !o); }
    if (e.key === "Escape") setCmdOpen(false);
  };

  const logout = () => {
    localStorage.removeItem(config.auth.tokenKey);
    setNavOpen(false);
    setUser(null);
  };

  if (location.pathname === "/landing") return <Navigate to="/" replace />;
  if (location.pathname === "/") return <LandingPage />;
  if (!user) return <LoginView onLogin={setUser} />;

  const districtName = bootstrap.districts.find((d) => d.id === route.id)?.name;

  return (
    <div ref={appRef} tabIndex={-1} onKeyDown={handleKeyDown} style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {!isMobile && <Sidebar route={route} onNav={goTo} onOpenCmd={() => setCmdOpen(true)} user={user} summary={summary} onLogout={logout} />}
      {isMobile && navOpen && (
        <div onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "oklch(0.08 0.01 235 / 0.6)", display: "flex" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(var(--sidebar-w), 86vw)", height: "100vh", boxShadow: "var(--shadow-lg)" }}>
            <Sidebar route={route} onNav={goTo} onOpenCmd={() => { setCmdOpen(true); setNavOpen(false); }} user={user} summary={summary} onLogout={logout} />
          </div>
        </div>
      )}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar route={route} districtName={districtName} pipeline={summary?.pipeline} onMenu={() => setNavOpen(true)} isMobile={isMobile} />
        <div ref={scrollRef} className="app-canvas" style={{ flex: 1, overflowY: "auto" }}>
          <Routes>
            <Route path="/dashboard" element={<Overview onSelectDistrict={selectDistrict} goTo={goTo} onScan={runScan} onAskAI={openAI} year="2023" />} />
            <Route path="/lab" element={<SignalLab onSelectDistrict={selectDistrict} />} />
            <Route path="/pipeline" element={<PipelineView />} />
            <Route path="/district/:id" element={<DistrictDetail id={route.id} onSelectDistrict={selectDistrict} goTo={goTo} onScan={runScan} onAskAI={() => setAiOpen(true)} />} />
            <Route path="/evidence" element={<EvidenceView scanTarget={scanTarget} onSelectDistrict={selectDistrict} goTo={goTo} />} />
            <Route path="/clusters" element={<ClustersView onSelectDistrict={selectDistrict} goTo={goTo} />} />
            <Route path="/peers" element={<PeersView anchorId={route.id} onSelectDistrict={selectDistrict} />} />
            <Route path="/tracker" element={<TrackerView onSelectDistrict={selectDistrict} />} />
            <Route path="/alerts" element={<AlertsView onSelectDistrict={selectDistrict} goTo={goTo} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>

      {/* AI floating button */}
      {!aiOpen && (
        <button onClick={() => setAiOpen(true)} style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 200,
          width: 52, height: 52, borderRadius: 99,
          background: "linear-gradient(135deg, var(--brand), var(--c-infra))",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)", transition: "transform 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          title="AI Analyst">
          <Icon name="spark" size={22} stroke={2} />
        </button>
      )}

      {/* AI slide-in panel */}
      {aiOpen && (
        <AIPanel
          currentDistrict={route.view === "district" ? route.id : null}
          onSelectDistrict={selectDistrict}
          onClose={() => setAiOpen(false)}
        />
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onSelectDistrict={selectDistrict} onNav={goTo} districts={bootstrap.districts || []} />
    </div>
  );
}

export default App;
