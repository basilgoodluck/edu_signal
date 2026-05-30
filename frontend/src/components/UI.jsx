import { useState } from "react";
/* EduSignal â€” shared UI primitives & design system */

/* ---------- helpers ---------- */
const CLUSTER_ORDER = ["seasonal_migration", "language_barrier", "teacher_shortage", "infrastructure", "pedagogical", "noise"];
const CLUSTERS = {
  seasonal_migration: { id: "seasonal_migration", label: "Seasonal migration", short: "Migration", color: "var(--c-migration)", tint: "var(--c-migration-tint)", blurb: "Learning drops line up with harvest-season attendance loss and family mobility.", window: "Oct-Dec return bridge", signature: ["High NDVI variance", "Migration news signals", "Negative reading trend"] },
  language_barrier: { id: "language_barrier", label: "Language barrier", short: "Language", color: "var(--c-language)", tint: "var(--c-language-tint)", blurb: "Home language mismatch is associated with weaker early reading outcomes.", window: "Grade 1-3 MT-MLE", signature: ["Large gender/language gap", "Mixed-language regions", "Forum complaints"] },
  teacher_shortage: { id: "teacher_shortage", label: "Teacher shortage", short: "Staffing", color: "var(--c-teacher)", tint: "var(--c-teacher-tint)", blurb: "High vacancy and PTR signals suggest constrained classroom attention.", window: "June staffing cycle", signature: ["High vacancy rate", "High PTR", "Open portal posts"] },
  infrastructure: { id: "infrastructure", label: "Infrastructure disruption", short: "Infra", color: "var(--c-infra)", tint: "var(--c-infra-tint)", blurb: "Flood exposure and weak connectivity point to physical access and facility constraints.", window: "Pre-monsoon repair", signature: ["Flood days", "Low infra score", "Weak road connectivity"] },
  pedagogical: { id: "pedagogical", label: "Pedagogical gap", short: "Pedagogy", color: "var(--c-pedagogy)", tint: "var(--c-pedagogy-tint)", blurb: "Adequate inputs but weak foundational outcomes indicate classroom practice gaps.", window: "Daily FLN block", signature: ["Adequate infrastructure", "Low FLN conversion", "Low vacancy pressure"] },
  noise: { id: "noise", label: "Unclassified signal", short: "Noise", color: "var(--neutral)", tint: "var(--neutral-tint)", blurb: "Districts without a stable dominant root-cause signature.", window: "Manual review", signature: ["Low confidence", "Mixed evidence", "Insufficient signal"] },
};
const FEATURE_LABELS = {
  reading3: "Grade 3 reading", arith5: "Grade 5 arithmetic", yoyReading: "YoY reading change",
  genderGap: "Gender reading gap", ptr: "Pupil-teacher ratio", vacancyRate: "Teacher vacancy rate",
  infraScore: "Infrastructure score", ndviVar: "NDVI seasonal variance", floodDays: "Flood days per year",
  roadIdx: "Road connectivity", vacancyPosts: "Open teacher posts", newsMigration: "Migration signal",
  newsFlood: "Flood signal", forumComplaints: "Forum complaints", confidence: "Cluster confidence",
};
const SOURCE_META = {
  news: { label: "News", icon: "NEWS" },
  satellite: { label: "Satellite", icon: "SAT" },
  vacancy_portal: { label: "Vacancy", icon: "JOB" },
  forum: { label: "Forum", icon: "FORUM" },
  ngo_report: { label: "NGO report", icon: "NGO" },
};
function clusterMeta(id) { return CLUSTERS[id] || CLUSTERS.noise; }
function pct(n) { return Math.round(n) + "%"; }
function signed(n, d = 1) { return (n > 0 ? "+" : "") + n.toFixed(d); }

const CLS_STYLE = {
  Supporting: { color: "var(--ok)", tint: "var(--ok-tint)", glyph: "ï¼‹" },
  Contradicting: { color: "var(--bad)", tint: "var(--bad-tint)", glyph: "ï¼" },
  Irrelevant: { color: "var(--neutral)", tint: "var(--neutral-tint)", glyph: "â—‹" },
};

/* ---------- minimal stroke icon set ---------- */
const ICONS = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  evidence: "M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h6",
  layers: "M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  pulse: "M3 12h4l2 6 4-14 2 8h6",
  bell: "M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 21h4",
  flask: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 18l-6-6 6-6",
  close: "M6 6l12 12M18 6 6 18",
  spark: "M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3",
  check: "M5 12l4 4 10-10",
  dot: "M12 12h.01",
  pin: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 10h.01",
  trend: "M3 17l6-6 4 4 8-8M21 7v5h-5",
  ext: "M14 4h6v6M20 4l-8 8M19 13v6H5V5h6",
  pipeline: "M4 7h6a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2h6M4 7v-1M4 7v1M20 17v-1M20 17v1M2 7h2M20 17h2",
};
function Icon({ name, size = 18, stroke = 1.8, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- cluster dot & badge ---------- */
function ClusterDot({ cluster, size = 9, ring }) {
  const m = clusterMeta(cluster);
  return (
    <span style={{
      width: size, height: size, borderRadius: 99, background: m.color,
      display: "inline-block", flex: "none",
      boxShadow: ring ? `0 0 0 3px ${m.tint}` : "none",
    }} />
  );
}

function ClusterBadge({ cluster, size = "md" }) {
  const m = clusterMeta(cluster);
  const pad = size === "sm" ? "3px 8px 3px 7px" : "5px 11px 5px 9px";
  const fs = size === "sm" ? 11.5 : 12.5;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7, padding: pad,
      borderRadius: 99, background: m.tint, color: m.color,
      fontSize: fs, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap",
    }}>
      <ClusterDot cluster={cluster} size={size === "sm" ? 7 : 8} />
      {m.label}
    </span>
  );
}

function ClassificationBadge({ value }) {
  const s = CLS_STYLE[value] || CLS_STYLE.Irrelevant;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px 3px 7px",
      borderRadius: 6, background: s.tint, color: s.color,
      fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", letterSpacing: "0.02em",
      textTransform: "uppercase",
    }}>
      <span style={{ fontSize: 12, lineHeight: 1 }}>{s.glyph}</span>{value}
    </span>
  );
}

function ConfidencePill({ value }) {
  const lvl = value >= 0.8 ? "High" : value >= 0.6 ? "Moderate" : value >= 0.45 ? "Low" : "Below threshold";
  const col = value >= 0.8 ? "var(--ok)" : value >= 0.6 ? "var(--c-migration)" : value >= 0.45 ? "var(--c-teacher)" : "var(--ink-3)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>
      <span style={{ width: 38, height: 5, borderRadius: 99, background: "var(--border)", overflow: "hidden", display: "inline-block" }}>
        <span style={{ display: "block", height: "100%", width: (value * 100) + "%", background: col, borderRadius: 99 }} />
      </span>
      <span className="mono tnum" style={{ color: col, fontWeight: 600 }}>{value.toFixed(2)}</span>
      <span style={{ color: "var(--ink-3)" }}>Â· {lvl}</span>
    </span>
  );
}

/* ---------- buttons ---------- */
function Button({ children, variant = "default", size = "md", icon, onClick, style, title, active }) {
  const [h, setH] = useState(false);
  const sizes = { sm: { p: "6px 11px", fs: 12.5 }, md: { p: "8px 14px", fs: 13.5 }, lg: { p: "11px 18px", fs: 14 } };
  const sz = sizes[size];
  const variants = {
    primary: { bg: h ? "var(--brand-strong)" : "var(--brand)", c: "#fff", b: "transparent" },
    default: { bg: h ? "var(--surface-2)" : "var(--surface)", c: "var(--ink)", b: "var(--border-strong)" },
    ghost: { bg: h || active ? "var(--surface-2)" : "transparent", c: active ? "var(--ink)" : "var(--ink-2)", b: "transparent" },
    subtle: { bg: h ? "var(--bg-sunken)" : "var(--surface-2)", c: "var(--ink)", b: "var(--border)" },
  };
  const v = variants[variant] || variants.default;
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: sz.p, fontSize: sz.fs,
        fontWeight: 600, letterSpacing: "-0.01em", borderRadius: var_r(size),
        background: v.bg, color: v.c, border: `1px solid ${v.b}`,
        boxShadow: variant === "primary" ? "var(--shadow-sm)" : "none",
        transition: "background 0.14s, border-color 0.14s, transform 0.08s", whiteSpace: "nowrap", ...style,
      }}>
      {icon && <Icon name={icon} size={sz.fs + 2.5} stroke={2} />}
      {children}
    </button>
  );
}
function var_r(size) { return size === "lg" ? "10px" : "var(--r-sm)"; }

/* ---------- card / panel ---------- */
function Card({ children, style, pad = 18, hover, onClick, className }) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} className={className}
      onMouseEnter={() => hover && setH(true)} onMouseLeave={() => hover && setH(false)}
      style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
        padding: pad, boxShadow: h ? "var(--shadow-md)" : "var(--shadow-sm)",
        transition: "box-shadow 0.16s, border-color 0.16s, transform 0.16s",
        transform: h ? "translateY(-2px)" : "none",
        borderColor: h ? "var(--border-strong)" : "var(--border)",
        cursor: onClick ? "pointer" : "default", ...style,
      }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, right, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, ...style }}>
      <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)" }}>{children}</div>
      {right}
    </div>
  );
}

function Stat({ label, value, sub, accent, delta, icon }) {
  const ac = accent || "var(--brand)";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {icon && (
        <span style={{ width: 36, height: 36, borderRadius: 10, flex: "none", display: "grid", placeItems: "center",
          background: `color-mix(in oklch, ${ac}, transparent 88%)`, color: ac, boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${ac}, transparent 80%)` }}>
          <Icon name={icon} size={18} stroke={2} />
        </span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</div>
        <div className="tnum" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em", color: accent || "var(--ink)", lineHeight: 1.1 }}>{value}</div>
        {(sub || delta != null) && (
          <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
            {delta != null && <span className="tnum" style={{ color: delta < 0 ? "var(--bad)" : "var(--ok)", fontWeight: 600 }}>{signed(delta)}</span>}
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- sparkline (trend) ---------- */
function Sparkline({ data, w = 120, h = 34, color = "var(--brand)", fill, dots }) {
  const vals = data.map((d) => d.reading3 != null ? d.reading3 : d);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * (w - 4) + 2;
    const y = h - 4 - ((v - min) / range) * (h - 8);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path + ` L${pts[pts.length-1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {fill && <path d={area} fill={color} opacity="0.08" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {dots && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 2.6 : 0} fill={color} />)}
    </svg>
  );
}

/* ---------- SHAP waterfall ---------- */
function ShapWaterfall({ shap, cluster }) {
  const m = clusterMeta(cluster);
  const maxAbs = Math.max(...shap.map((s) => Math.abs(s.contribution)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {shap.map((s, i) => {
        const w = (Math.abs(s.contribution) / maxAbs) * 100;
        const pos = s.contribution >= 0;
        return (
          <div key={s.feature} style={{ display: "grid", gridTemplateColumns: "150px 1fr 52px", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", textAlign: "right", fontWeight: 500 }}>{FEATURE_LABELS[s.feature] || s.feature}</div>
            <div style={{ position: "relative", height: 22, display: "flex", justifyContent: "center", background: "linear-gradient(90deg, transparent 49.7%, var(--border) 49.7%, var(--border) 50.3%, transparent 50.3%)" }}>
              <div style={{ position: "absolute", top: 3, height: 16, borderRadius: 4,
                width: (w / 2) + "%",
                left: pos ? "50%" : "auto", right: pos ? "auto" : "50%",
                background: pos ? m.color : "var(--ink-faint)",
                transformOrigin: pos ? "left" : "right",
                animation: `growBar 0.5s cubic-bezier(0.2,0.8,0.2,1) ${i * 0.06}s both`,
              }} />
            </div>
            <div className="mono tnum" style={{ fontSize: 11.5, fontWeight: 600, color: pos ? m.color : "var(--ink-3)", textAlign: "right" }}>{signed(s.contribution, 2)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- source clipping meta ---------- */
function SourceTag({ sourceType }) {
  const meta = SOURCE_META[sourceType] || { label: sourceType.toUpperCase(), icon: "â€¢" };
  return (
    <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--ink-3)" }}>
      <span style={{ fontSize: 11 }}>{meta.icon}</span>{meta.label}
    </span>
  );
}

export {
  CLUSTER_ORDER, CLUSTERS, FEATURE_LABELS, SOURCE_META,
  clusterMeta, pct, signed, CLS_STYLE,
  Icon, ICONS, ClusterDot, ClusterBadge, ClassificationBadge, ConfidencePill,
  Button, Card, SectionLabel, Stat, Sparkline, ShapWaterfall, SourceTag,
};
