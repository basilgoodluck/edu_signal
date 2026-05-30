import { useState as useStateC, useRef as useRefC, useEffect as useEffectC, useMemo as useMemoC } from "react";
import { clusterMeta, ClusterDot, signed, CLUSTER_ORDER, FEATURE_LABELS, CLUSTERS } from "./UI.jsx";
let DC = { DISTRICTS: [], CLUSTERS, CLUSTER_ORDER, FEATURE_LABELS, byId: {} };

function setChartData(districts = []) {
  const normalized = districts.map((district) => ({
    arith5: district.arith5 ?? district.reading3 ?? 0,
    genderGap: district.genderGap ?? 0,
    ndviVar: district.ndviVar ?? 0,
    floodDays: district.floodDays ?? 0,
    ptr: district.ptr ?? 0,
    vacancyRate: district.vacancyRate ?? 0,
    infraScore: district.infraScore ?? 0,
    roadIdx: district.roadIdx ?? 0,
    vacancyPosts: district.vacancyPosts ?? 0,
    newsMigration: district.newsMigration ?? 0,
    newsFlood: district.newsFlood ?? 0,
    forumComplaints: district.forumComplaints ?? 0,
    shap: district.shap || [],
    trend: district.trend || [
      { year: 2021, reading3: district.reading3 ?? 0, arith5: district.arith5 ?? district.reading3 ?? 0 },
      { year: 2022, reading3: district.reading3 ?? 0, arith5: district.arith5 ?? district.reading3 ?? 0 },
      { year: 2023, reading3: district.reading3 ?? 0, arith5: district.arith5 ?? district.reading3 ?? 0 },
    ],
    peers: district.peers || [],
    ...district,
  }));
  const byId = Object.fromEntries(normalized.map((district) => [district.id, district]));
  DC = { DISTRICTS: normalized, CLUSTERS, CLUSTER_ORDER, FEATURE_LABELS, byId };
}
/* EduSignal — interactive chart engine (pure SVG/React, no deps) */

/* ============ math / scales ============ */
function lin(d0, d1, r0, r1) {
  const m = (r1 - r0) / (d1 - d0 || 1);
  const f = (v) => r0 + (v - d0) * m;
  f.invert = (p) => d0 + (p - r0) / m;
  return f;
}
function extent(arr, acc = (x) => x) {
  let lo = Infinity, hi = -Infinity;
  arr.forEach((d) => { const v = acc(d); if (v < lo) lo = v; if (v > hi) hi = v; });
  return [lo, hi];
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
function mean(a) { return a.reduce((s, x) => s + x, 0) / (a.length || 1); }
function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { const a = x[i] - mx, b = y[i] - my; num += a * b; dx += a * a; dy += b * b; }
  return num / (Math.sqrt(dx * dy) || 1);
}

/* continuous diverging color (blue ↔ neutral ↔ red), t in [-1,1] */
function divColor(t) {
  const a = Math.max(-1, Math.min(1, t));
  if (a >= 0) return `oklch(${0.92 - a * 0.32} ${0.04 + a * 0.14} 25)`;
  return `oklch(${0.92 + a * 0.32} ${0.04 - a * 0.14} 250)`;
}
function seqColor(t) { const a = Math.max(0, Math.min(1, t)); return `oklch(${0.95 - a * 0.45} ${0.03 + a * 0.16} 268)`; }

/* convex hull (Andrew monotone chain) */
function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const pt of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop(); lower.push(pt); }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) { const pt = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop(); upper.push(pt); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
/* expand hull outward from centroid + smooth into a blob path */
function blobPath(pts, padPx = 20) {
  if (pts.length < 2) {
    const [x, y] = pts[0] || [0, 0];
    return `M ${x - 30} ${y} a 30 30 0 1 0 60 0 a 30 30 0 1 0 -60 0`;
  }
  const hull = convexHull(pts);
  const cx = mean(hull.map((p) => p[0])), cy = mean(hull.map((p) => p[1]));
  const exp = hull.map(([x, y]) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1; return [x + (dx / d) * padPx, y + (dy / d) * padPx]; });
  // catmull-rom -> bezier, closed
  const n = exp.length;
  let path = `M ${exp[0][0].toFixed(1)} ${exp[0][1].toFixed(1)} `;
  for (let i = 0; i < n; i++) {
    const p0 = exp[(i - 1 + n) % n], p1 = exp[i], p2 = exp[(i + 1) % n], p3 = exp[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
  }
  return path + "Z";
}

/* ============ chart frame w/ tooltip ============ */
function ChartFrame({ title, caption, right, children, height, footer, pad = 18 }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: `${pad}px ${pad}px 10px`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em" }}>{title}</div>
          {caption && <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 3 }}>{caption}</div>}
        </div>
        {right}
      </div>
      <div style={{ position: "relative", flex: 1, padding: `0 ${pad}px` }}>{children}</div>
      {footer && <div style={{ padding: `10px ${pad}px ${pad}px` }}>{footer}</div>}
    </div>
  );
}

function Tip({ x, y, children, w = 170 }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, calc(-100% - 12px))", pointerEvents: "none", zIndex: 5,
      background: "var(--ink)", color: "var(--surface)", borderRadius: "var(--r-sm)", padding: "9px 11px", minWidth: w, boxShadow: "var(--shadow-md)", animation: "fadeIn 0.1s ease" }}>
      {children}
    </div>
  );
}

/* ============ 1. CLUSTER EMBEDDING (UMAP-style) ============ */
const CENTROIDS = {
  seasonal_migration: [27, 31], language_barrier: [73, 27], teacher_shortage: [25, 73],
  infrastructure: [76, 71], pedagogical: [50, 50], noise: [50, 86],
};
function embedCoords(d) {
  const c = CENTROIDS[d.cluster] || [50, 50];
  const conf = d.confidence;
  const spread = (1 - conf) * 26 + 6;
  const ang = hashStr(d.id) * Math.PI * 2;
  const rad = hashStr(d.id + "r") * spread;
  const fx = (d.ndviVar - 0.3) * 18 + (d.vacancyRate - 0.15) * -10;
  const fy = (d.floodDays - 15) * 0.25 + (d.reading3 - 24) * 0.3;
  return [c[0] + Math.cos(ang) * rad + fx, c[1] + Math.sin(ang) * rad + fy];
}

function ClusterEmbedding({ onSelect, height = 440 }) {
  const W = 600, H = 460, PAD = 28;
  const [hover, setHover] = useStateC(null);
  const [activeCluster, setActiveCluster] = useStateC(null);
  const wrapRef = useRefC(null);

  const pts = useMemoC(() => DC.DISTRICTS.map((d) => ({ d, raw: embedCoords(d) })), []);
  const xs = pts.map((p) => p.raw[0]), ys = pts.map((p) => p.raw[1]);
  const sx = lin(Math.min(...xs) - 8, Math.max(...xs) + 8, PAD, W - PAD);
  const sy = lin(Math.min(...ys) - 8, Math.max(...ys) + 8, PAD, H - PAD);
  const placed = pts.map((p) => ({ ...p, x: sx(p.raw[0]), y: sy(p.raw[1]) }));

  const byCluster = {};
  placed.forEach((p) => { (byCluster[p.d.cluster] = byCluster[p.d.cluster] || []).push([p.x, p.y]); });

  const hoverP = hover ? placed.find((p) => p.d.id === hover) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <pattern id="emgrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M30 0H0V30" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.6" />
          </pattern>
        </defs>
        <rect x={PAD - 14} y={PAD - 14} width={W - 2 * PAD + 28} height={H - 2 * PAD + 28} fill="url(#emgrid)" rx="8" />
        {/* cluster hulls */}
        {Object.entries(byCluster).map(([cid, arr]) => {
          if (cid === "noise") return null;
          const m = clusterMeta(cid);
          const dim = activeCluster && activeCluster !== cid;
          return <path key={cid} d={blobPath(arr, 26)} fill={m.color} opacity={dim ? 0.03 : 0.1} stroke={m.color} strokeWidth="1.2" strokeOpacity={dim ? 0.15 : 0.5} strokeDasharray="4 4" style={{ transition: "opacity 0.25s" }} />;
        })}
        {/* cluster labels */}
        {Object.entries(byCluster).map(([cid, arr]) => {
          if (cid === "noise") return null;
          const m = clusterMeta(cid);
          const cx = mean(arr.map((a) => a[0])), cy = Math.min(...arr.map((a) => a[1])) - 30;
          return <text key={"l" + cid} x={cx} y={cy} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={m.color} fontFamily="var(--mono)" style={{ textTransform: "uppercase", letterSpacing: "0.06em", opacity: activeCluster && activeCluster !== cid ? 0.2 : 0.9, transition: "opacity 0.25s" }}>{m.short}</text>;
        })}
        {/* points */}
        {placed.map((p) => {
          const m = clusterMeta(p.d.cluster);
          const dim = activeCluster && activeCluster !== p.d.cluster;
          const isH = hover === p.d.id;
          const r = 4.5 + (40 - p.d.reading3) / 7;
          return (
            <g key={p.d.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: "pointer", opacity: dim ? 0.12 : 1, transition: "opacity 0.25s" }}
              onMouseEnter={() => setHover(p.d.id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(p.d.id)}>
              {isH && <circle r={r + 6} fill={m.color} opacity="0.18" />}
              <circle r={r} fill={m.color} stroke="var(--surface)" strokeWidth="1.5" />
              {p.d.cluster === "noise" && <circle r={r} fill="none" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="2 2" />}
              {p.d.featured && <circle r="1.8" fill="#fff" />}
            </g>
          );
        })}
      </svg>
      {/* legend toggles */}
      <div style={{ position: "absolute", bottom: 4, left: 18, display: "flex", flexWrap: "wrap", gap: 5 }}>
        {DC.CLUSTER_ORDER.map((cid) => {
          const m = DC.CLUSTERS[cid]; const on = activeCluster === cid;
          return <button key={cid} onClick={() => setActiveCluster(on ? null : cid)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 99, fontSize: 10.5, fontWeight: 600, border: `1px solid ${on ? m.color : "var(--border)"}`, background: on ? m.tint : "var(--surface)", color: on ? m.color : "var(--ink-3)" }}><ClusterDot cluster={cid} size={7} />{m.short}</button>;
        })}
      </div>
      {hoverP && (
        <Tip x={hoverP.x / W * (wrapRef.current ? wrapRef.current.clientWidth : W)} y={hoverP.y / H * height}>
          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{hoverP.d.name}</div>
          <div className="mono" style={{ fontSize: 10, opacity: 0.7, marginBottom: 5 }}>{hoverP.d.state}</div>
          <div style={{ display: "flex", gap: 12 }}>
            <span className="mono" style={{ fontSize: 10.5 }}>read <b>{hoverP.d.reading3}%</b></span>
            <span className="mono" style={{ fontSize: 10.5 }}>conf <b>{hoverP.d.confidence.toFixed(2)}</b></span>
          </div>
        </Tip>
      )}
    </div>
  );
}

/* ============ 2. SHAP BEESWARM ============ */
function ShapBeeswarm({ height = 320 }) {
  const W = 600, H = 340, PADL = 132, PADR = 30, PADT = 14, PADB = 28;
  const [hover, setHover] = useStateC(null);
  const wrapRef = useRefC(null);

  const rows = useMemoC(() => {
    const agg = {};
    DC.DISTRICTS.forEach((d) => d.shap.forEach((s) => {
      (agg[s.feature] = agg[s.feature] || []).push({ feature: s.feature, contribution: s.contribution, district: d.name, cluster: d.cluster, id: d.id });
    }));
    return Object.entries(agg).map(([f, items]) => ({ f, items, imp: mean(items.map((i) => Math.abs(i.contribution))) }))
      .sort((a, b) => b.imp - a.imp).slice(0, 8);
  }, []);
  const allC = rows.flatMap((r) => r.items.map((i) => i.contribution));
  const sx = lin(Math.min(...allC, -0.1), Math.max(...allC, 0.1), PADL, W - PADR);
  const rowH = (H - PADT - PADB) / rows.length;
  const zero = sx(0);

  return (
    <div ref={wrapRef} style={{ position: "relative", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible" }}>
        <line x1={zero} y1={PADT} x2={zero} y2={H - PADB} stroke="var(--border-strong)" strokeWidth="1" />
        <text x={zero} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--mono)">0</text>
        <text x={W - PADR} y={H - 8} textAnchor="end" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--mono)">→ pushes INTO cluster</text>
        {rows.map((r, ri) => {
          const cy = PADT + ri * rowH + rowH / 2;
          return (
            <g key={r.f}>
              {ri % 2 === 0 && <rect x={PADL - 4} y={PADT + ri * rowH} width={W - PADR - PADL + 4} height={rowH} fill="var(--surface-2)" opacity="0.5" />}
              <text x={PADL - 12} y={cy + 3} textAnchor="end" fontSize="11" fill="var(--ink-2)" fontWeight="500" fontFamily="var(--sans)">{DC.FEATURE_LABELS[r.f]}</text>
              {r.items.map((it, ii) => {
                const x = sx(it.contribution);
                const jitter = (hashStr(it.id + r.f) - 0.5) * (rowH - 12);
                const m = clusterMeta(it.cluster);
                const key = it.id + r.f;
                const isH = hover === key;
                return <circle key={key} cx={x} cy={cy + jitter} r={isH ? 6 : 4} fill={m.color} stroke="var(--surface)" strokeWidth="1" opacity={hover && !isH ? 0.35 : 0.85} style={{ cursor: "pointer", transition: "opacity 0.12s, r 0.12s" }}
                  onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} />;
              })}
            </g>
          );
        })}
      </svg>
      {hover && (() => {
        const [rf] = rows.map((r) => r.items.find((i) => i.id + r.f === hover)).filter(Boolean);
        if (!rf) return null;
        const x = sx(rf.contribution), ri = rows.findIndex((r) => r.items.some((i) => i.id + r.f === hover));
        const cy = PADT + ri * rowH + rowH / 2;
        const ww = wrapRef.current ? wrapRef.current.clientWidth : W;
        return <Tip x={x / W * ww} y={cy / H * height} w={150}><div style={{ fontWeight: 600, fontSize: 12 }}>{rf.district}</div><div className="mono" style={{ fontSize: 10.5, marginTop: 3 }}>{DC.FEATURE_LABELS[rf.f]}: <b>{signed(rf.contribution, 2)}</b></div></Tip>;
      })()}
    </div>
  );
}

/* ============ 3. CORRELATION HEATMAP ============ */
function CorrHeatmap({ height = 340 }) {
  const feats = ["reading3", "arith5", "ndviVar", "floodDays", "ptr", "vacancyRate", "newsMigration", "infraScore"];
  const [hover, setHover] = useStateC(null);
  const wrapRef = useRefC(null);
  const matrix = useMemoC(() => {
    const cols = feats.map((f) => DC.DISTRICTS.map((d) => d[f]));
    return feats.map((_, i) => feats.map((_, j) => pearson(cols[i], cols[j])));
  }, []);
  const W = 460, H = 460, PADL = 92, PADT = 92, cell = (W - PADL - 16) / feats.length;
  const shortF = { reading3: "Read G3", arith5: "Arith G5", ndviVar: "NDVI var", floodDays: "Floods", ptr: "PTR", vacancyRate: "Vacancy", newsMigration: "News mig.", infraScore: "Infra" };

  return (
    <div ref={wrapRef} style={{ position: "relative", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible" }}>
        {feats.map((f, j) => (
          <text key={"ct" + f} x={PADL + j * cell + cell / 2} y={PADT - 8} fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--mono)" textAnchor="start" transform={`rotate(-45 ${PADL + j * cell + cell / 2} ${PADT - 8})`}>{shortF[f]}</text>
        ))}
        {feats.map((f, i) => (
          <text key={"rt" + f} x={PADL - 8} y={PADT + i * cell + cell / 2 + 3} fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--mono)" textAnchor="end">{shortF[f]}</text>
        ))}
        {matrix.map((row, i) => row.map((v, j) => {
          const isH = hover && hover[0] === i && hover[1] === j;
          return (
            <g key={i + "-" + j}>
              <rect x={PADL + j * cell} y={PADT + i * cell} width={cell - 2} height={cell - 2} rx="2" fill={divColor(v)} stroke={isH ? "var(--ink)" : "transparent"} strokeWidth="1.5"
                style={{ cursor: "pointer" }} onMouseEnter={() => setHover([i, j])} onMouseLeave={() => setHover(null)} />
              {(Math.abs(v) > 0.45 || isH) && <text x={PADL + j * cell + cell / 2 - 1} y={PADT + i * cell + cell / 2 + 3} textAnchor="middle" fontSize="9" fontFamily="var(--mono)" fill={Math.abs(v) > 0.55 ? "#fff" : "var(--ink-2)"} style={{ pointerEvents: "none" }}>{v.toFixed(2)}</text>}
            </g>
          );
        }))}
      </svg>
      {hover && (() => {
        const v = matrix[hover[0]][hover[1]]; const ww = wrapRef.current ? wrapRef.current.clientWidth : W;
        const x = (PADL + hover[1] * cell + cell / 2) / W * ww; const y = (PADT + hover[0] * cell) / H * height;
        return <Tip x={x} y={y} w={150}><div className="mono" style={{ fontSize: 10.5 }}>{shortF[feats[hover[0]]]} Ã— {shortF[feats[hover[1]]]}</div><div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>r = {v.toFixed(2)}</div></Tip>;
      })()}
    </div>
  );
}

/* ============ 4. DISTRIBUTION HISTOGRAM (stacked by cluster) ============ */
function ScoreHistogram({ height = 230 }) {
  const W = 600, H = 240, PADL = 36, PADB = 30, PADT = 12, PADR = 14;
  const bins = [];
  for (let b = 10; b < 35; b += 4) bins.push({ lo: b, hi: b + 4, by: {} });
  DC.DISTRICTS.forEach((d) => { const bin = bins.find((bb) => d.reading3 >= bb.lo && d.reading3 < bb.hi) || bins[bins.length - 1]; bin.by[d.cluster] = (bin.by[d.cluster] || 0) + 1; });
  const maxC = Math.max(...bins.map((b) => Object.values(b.by).reduce((s, x) => s + x, 0)));
  const bw = (W - PADL - PADR) / bins.length;
  const sy = lin(0, maxC, H - PADB, PADT);
  return (
    <div style={{ position: "relative", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {[0, Math.ceil(maxC / 2), maxC].map((t) => (
          <g key={t}><line x1={PADL} y1={sy(t)} x2={W - PADR} y2={sy(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray={t === 0 ? "0" : "2 4"} /><text x={PADL - 6} y={sy(t) + 3} textAnchor="end" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--mono)">{t}</text></g>
        ))}
        {bins.map((b, bi) => {
          let yAcc = 0;
          return (
            <g key={bi}>
              {DC.CLUSTER_ORDER.map((cid) => {
                const c = b.by[cid] || 0; if (!c) return null;
                const h = (H - PADB - PADT) * (c / maxC); const y = sy(yAcc + c); yAcc += c;
                return <rect key={cid} x={PADL + bi * bw + 3} y={y} width={bw - 6} height={h - 1} fill={clusterMeta(cid).color} rx="1.5" style={{ animation: `growBar 0.5s ease ${bi * 0.05}s both`, transformOrigin: "bottom" }} />;
              })}
              <text x={PADL + bi * bw + bw / 2} y={H - 10} textAnchor="middle" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--mono)">{b.lo}</text>
            </g>
          );
        })}
        <text x={PADL} y={H - 10} fontSize="0" />
      </svg>
    </div>
  );
}

/* ============ 5. RADAR (district vs cluster vs national) ============ */
function RadarChart({ districtId, height = 300 }) {
  const d = DC.byId[districtId];
  if (!d) {
    return <div style={{ height, display: "grid", placeItems: "center" }} className="mono">Loading chart...</div>;
  }
  const axes = [
    { k: "reading3", label: "Reading", dom: [10, 35] },
    { k: "arith5", label: "Arithmetic", dom: [5, 30] },
    { k: "infraScore", label: "Infra", dom: [0.3, 0.8] },
    { k: "roadIdx", label: "Connectivity", dom: [0.25, 0.7] },
    { k: "ptrInv", label: "Staffing", dom: [0, 1], inv: true },
    { k: "vacInv", label: "Posts filled", dom: [0, 1], inv: true },
  ];
  const norm = (dist, ax) => {
    let v;
    if (ax.k === "ptrInv") v = 1 - (dist.ptr - 30) / 40;
    else if (ax.k === "vacInv") v = 1 - dist.vacancyRate / 0.4;
    else v = (dist[ax.k] - ax.dom[0]) / (ax.dom[1] - ax.dom[0]);
    return Math.max(0.04, Math.min(1, v));
  };
  const peers = DC.DISTRICTS.filter((x) => x.cluster === d.cluster);
  const clusterAvg = (ax) => mean(peers.map((p) => norm(p, ax)));
  const natAvg = (ax) => mean(DC.DISTRICTS.map((p) => norm(p, ax)));

  const W = 320, H = 300, cx = W / 2, cy = H / 2 + 6, R = 96;
  const ptFor = (vals) => axes.map((ax, i) => {
    const ang = -Math.PI / 2 + (i / axes.length) * Math.PI * 2;
    const r = vals[i] * R;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  });
  const m = clusterMeta(d.cluster);
  const series = [
    { name: "National avg", color: "var(--ink-faint)", vals: axes.map(natAvg), fill: false },
    { name: "Cluster avg", color: m.color, vals: axes.map(clusterAvg), fill: false, dash: "4 3" },
    { name: d.name, color: "var(--brand)", vals: axes.map((ax) => norm(d, ax)), fill: true },
  ];
  const toPath = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + "Z";

  return (
    <div style={{ height, display: "flex", flexDirection: "column" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible", flex: 1 }}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <polygon key={g} points={axes.map((_, i) => { const a = -Math.PI / 2 + (i / axes.length) * Math.PI * 2; return (cx + Math.cos(a) * R * g) + "," + (cy + Math.sin(a) * R * g); }).join(" ")} fill="none" stroke="var(--border)" strokeWidth="1" />
        ))}
        {axes.map((ax, i) => {
          const a = -Math.PI / 2 + (i / axes.length) * Math.PI * 2;
          const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
          const lx = cx + Math.cos(a) * (R + 20), ly = cy + Math.sin(a) * (R + 16);
          return <g key={ax.k}><line x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--border)" strokeWidth="1" /><text x={lx} y={ly + 3} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--mono)" fontWeight="600">{ax.label}</text></g>;
        })}
        {series.map((s) => {
          const pts = ptFor(s.vals);
          return <g key={s.name}><path d={toPath(pts)} fill={s.fill ? s.color : "none"} fillOpacity={s.fill ? 0.14 : 0} stroke={s.color} strokeWidth={s.fill ? 2 : 1.5} strokeDasharray={s.dash || "0"} strokeLinejoin="round" />{s.fill && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill={s.color} />)}</g>;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 4 }}>
        {series.map((s) => <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--ink-2)" }} className="mono"><span style={{ width: 11, height: 2.5, background: s.color, borderRadius: 2 }} />{s.name}</span>)}
      </div>
    </div>
  );
}

/* ============ 6. MULTI-SERIES TREND w/ crosshair ============ */
function TrendChart({ district, height = 240 }) {
  const d = district || DC.DISTRICTS[0];
  const W = 600, H = 250, PADL = 38, PADB = 28, PADT = 14, PADR = 16;
  const [hoverI, setHoverI] = useStateC(null);
  const wrapRef = useRefC(null);
  const years = d.trend.map((t) => t.year);
  const sx = lin(0, years.length - 1, PADL, W - PADR);
  const allV = d.trend.flatMap((t) => [t.reading3, t.arith5]);
  const sy = lin(Math.min(...allV) - 3, Math.max(...allV) + 3, H - PADB, PADT);
  const m = clusterMeta(d.cluster);
  const series = [{ k: "reading3", label: "Reading G3", color: m.color }, { k: "arith5", label: "Arithmetic G5", color: "var(--ink-3)" }];
  const path = (k) => d.trend.map((t, i) => (i ? "L" : "M") + sx(i) + " " + sy(t[k])).join(" ");
  const area = (k) => path(k) + ` L ${sx(years.length - 1)} ${H - PADB} L ${sx(0)} ${H - PADB} Z`;

  return (
    <div ref={wrapRef} style={{ position: "relative", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; setHoverI(Math.max(0, Math.min(years.length - 1, Math.round(sx.invert(px))))); }}
        onMouseLeave={() => setHoverI(null)}>
        {[0, 1, 2, 3].map((g) => { const v = Math.min(...allV) + (Math.max(...allV) - Math.min(...allV)) * g / 3; return <g key={g}><line x1={PADL} y1={sy(v)} x2={W - PADR} y2={sy(v)} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" /><text x={PADL - 6} y={sy(v) + 3} textAnchor="end" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--mono)">{Math.round(v)}</text></g>; })}
        {series.map((s) => <path key={"a" + s.k} d={area(s.k)} fill={s.color} opacity="0.06" />)}
        {series.map((s) => <path key={s.k} d={path(s.k)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />)}
        {hoverI != null && <line x1={sx(hoverI)} y1={PADT} x2={sx(hoverI)} y2={H - PADB} stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="3 3" />}
        {series.map((s) => d.trend.map((t, i) => <circle key={s.k + i} cx={sx(i)} cy={sy(t[s.k])} r={hoverI === i ? 4.5 : 2.4} fill={s.color} stroke="var(--surface)" strokeWidth="1.5" style={{ transition: "r 0.1s" }} />))}
        {years.map((y, i) => <text key={y} x={sx(i)} y={H - 9} textAnchor="middle" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--mono)">{y}</text>)}
      </svg>
      {hoverI != null && (
        <Tip x={sx(hoverI) / W * (wrapRef.current ? wrapRef.current.clientWidth : W)} y={PADT / H * height} w={140}>
          <div className="mono" style={{ fontSize: 10.5, opacity: 0.7, marginBottom: 4 }}>{years[hoverI]}</div>
          {series.map((s) => <div key={s.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11 }} className="mono"><span><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 99, background: s.color, marginRight: 5 }} />{s.label}</span><b>{d.trend[hoverI][s.k]}%</b></div>)}
        </Tip>
      )}
    </div>
  );
}

/* ============ 7. CAUSE STREAMGRAPH over time ============ */
function CauseStream({ height = 260 }) {
  const W = 600, H = 270, PADL = 10, PADB = 26, PADT = 14, PADR = 10;
  const years = [2018, 2019, 2020, 2021, 2022, 2023];
  const clusters = DC.CLUSTER_ORDER.filter((c) => c !== "noise");
  // synthesize prevalence series (deterministic, rising detection over time)
  const data = useMemoC(() => {
    return years.map((y, yi) => {
      const row = { year: y };
      clusters.forEach((cid) => {
        const base = DC.DISTRICTS.filter((d) => d.cluster === cid).length;
        row[cid] = Math.max(0.4, base * (0.4 + yi * 0.13) + (hashStr(cid + y) - 0.5) * 1.2);
      });
      return row;
    });
  }, []);
  const totals = data.map((r) => clusters.reduce((s, c) => s + r[c], 0));
  const maxTot = Math.max(...totals);
  const sx = lin(0, years.length - 1, PADL + 4, W - PADR);
  const sy = lin(-maxTot / 2, maxTot / 2, H - PADB, PADT);
  const [hover, setHover] = useStateC(null);
  // wiggle-centered stacking
  const layers = clusters.map((cid) => data.map((r) => r[cid]));
  const baselines = data.map((_, yi) => { const tot = totals[yi]; return -tot / 2; });
  const bands = clusters.map((cid, ci) => {
    let path = "";
    const tops = [], bots = [];
    data.forEach((r, yi) => {
      let acc = baselines[yi];
      for (let k = 0; k < ci; k++) acc += data[yi][clusters[k]];
      const bot = acc, top = acc + r[cid];
      bots.push([sx(yi), sy(bot)]); tops.push([sx(yi), sy(top)]);
    });
    path = "M" + tops.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ") + " L " + bots.reverse().map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L ") + " Z";
    return { cid, path };
  });
  return (
    <div style={{ position: "relative", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: "block" }}>
        {bands.map((b) => { const m = clusterMeta(b.cid); const dim = hover && hover !== b.cid; return <path key={b.cid} d={b.path} fill={m.color} opacity={dim ? 0.25 : 0.82} stroke="var(--surface)" strokeWidth="1" style={{ cursor: "pointer", transition: "opacity 0.18s" }} onMouseEnter={() => setHover(b.cid)} onMouseLeave={() => setHover(null)} />; })}
        {years.map((y, i) => <text key={y} x={sx(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--ink-faint)" fontFamily="var(--mono)">{y}</text>)}
      </svg>
      <div style={{ position: "absolute", top: 8, right: 12, display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
        {clusters.map((cid) => <span key={cid} onMouseEnter={() => setHover(cid)} onMouseLeave={() => setHover(null)} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: hover && hover !== cid ? "var(--ink-faint)" : "var(--ink-2)", cursor: "default" }} className="mono"><ClusterDot cluster={cid} size={7} />{clusterMeta(cid).short}</span>)}
      </div>
    </div>
  );
}

/* ============ 8. PEER / INTERVENTION-TRANSFER NETWORK (force-directed) ============ */
function PeerNetwork({ onSelect, anchorId, height = 460 }) {
  const W = 600, H = 470;
  const [hover, setHover] = useStateC(null);
  const wrapRef = useRefC(null);
  const rafRef = useRefC(null);
  const stateRef = useRefC(null);
  const [, setTick] = useStateC(0);

  // build graph
  const { nodes, edges } = useMemoC(() => {
    const nodes = DC.DISTRICTS.map((d) => ({ id: d.id, d }));
    const seen = new Set(), edges = [];
    DC.DISTRICTS.forEach((d) => (d.peers || []).forEach((p) => {
      const key = [d.id, p].sort().join("|");
      if (!seen.has(key) && DC.byId[p]) { seen.add(key); edges.push({ a: d.id, b: p }); }
    }));
    return { nodes, edges };
  }, []);

  useEffectC(() => {
    // init positions seeded near cluster centroids
    const pos = {}, vel = {};
    nodes.forEach((n) => {
      const c = CENTROIDS[n.d.cluster] || [50, 50];
      pos[n.id] = [c[0] / 100 * W + (hashStr(n.id) - 0.5) * 60, c[1] / 100 * H + (hashStr(n.id + "y") - 0.5) * 60];
      vel[n.id] = [0, 0];
    });
    stateRef.current = { pos, vel };
    let iter = 0;
    const step = () => {
      const { pos, vel } = stateRef.current;
      const ids = nodes.map((n) => n.id);
      // repulsion
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const A = pos[ids[i]], B = pos[ids[j]];
        let dx = A[0] - B[0], dy = A[1] - B[1]; let dist2 = dx * dx + dy * dy || 1; let dist = Math.sqrt(dist2);
        const f = 2600 / dist2; const fx = (dx / dist) * f, fy = (dy / dist) * f;
        vel[ids[i]][0] += fx; vel[ids[i]][1] += fy; vel[ids[j]][0] -= fx; vel[ids[j]][1] -= fy;
      }
      // springs
      edges.forEach((e) => {
        const A = pos[e.a], B = pos[e.b]; let dx = B[0] - A[0], dy = B[1] - A[1]; const dist = Math.hypot(dx, dy) || 1;
        const f = (dist - 92) * 0.045; const fx = (dx / dist) * f, fy = (dy / dist) * f;
        vel[e.a][0] += fx; vel[e.a][1] += fy; vel[e.b][0] -= fx; vel[e.b][1] -= fy;
      });
      // centering + integrate
      ids.forEach((id) => {
        vel[id][0] += (W / 2 - pos[id][0]) * 0.008; vel[id][1] += (H / 2 - pos[id][1]) * 0.008;
        vel[id][0] *= 0.82; vel[id][1] *= 0.82;
        pos[id][0] += vel[id][0]; pos[id][1] += vel[id][1];
        pos[id][0] = Math.max(28, Math.min(W - 28, pos[id][0])); pos[id][1] = Math.max(28, Math.min(H - 28, pos[id][1]));
      });
      iter++;
      setTick((t) => t + 1);
      if (iter < 260) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [nodes, edges]);

  const pos = stateRef.current ? stateRef.current.pos : null;
  const neighbors = useMemoC(() => {
    const map = {}; edges.forEach((e) => { (map[e.a] = map[e.a] || new Set()).add(e.b); (map[e.b] = map[e.b] || new Set()).add(e.a); }); return map;
  }, [edges]);
  const focus = hover || anchorId;
  const hoverD = focus ? DC.byId[focus] : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible" }}>
        {pos && edges.map((e, i) => {
          const A = pos[e.a], B = pos[e.b]; if (!A || !B) return null;
          const active = focus && (e.a === focus || e.b === focus);
          const m = clusterMeta(DC.byId[e.a].cluster);
          return <line key={i} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={active ? m.color : "var(--border-strong)"} strokeWidth={active ? 2 : 1} opacity={focus && !active ? 0.12 : active ? 0.7 : 0.4} style={{ transition: "opacity 0.15s" }} />;
        })}
        {pos && nodes.map((n) => {
          const P = pos[n.id]; if (!P) return null;
          const m = clusterMeta(n.d.cluster);
          const isFocus = focus === n.id;
          const isNeighbor = focus && neighbors[focus] && neighbors[focus].has(n.id);
          const dim = focus && !isFocus && !isNeighbor;
          const r = 7 + (40 - n.d.reading3) / 6;
          return (
            <g key={n.id} transform={`translate(${P[0]},${P[1]})`} style={{ cursor: "pointer", opacity: dim ? 0.18 : 1, transition: "opacity 0.15s" }}
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect && onSelect(n.id)}>
              {(isFocus || n.id === anchorId) && <circle r={r + 6} fill={m.color} opacity="0.18" />}
              <circle r={r} fill={m.color} stroke={n.id === anchorId ? "var(--ink)" : "var(--surface)"} strokeWidth={n.id === anchorId ? 2.5 : 1.6} />
              {n.d.peers.length === 0 && <circle r={r} fill="none" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="2 2" />}
              {(isFocus || isNeighbor || n.id === anchorId) && <text y={-r - 6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--ink)" fontFamily="var(--sans)">{n.d.name}</text>}
            </g>
          );
        })}
      </svg>
      {hoverD && (() => {
        const P = pos && pos[hoverD.id]; if (!P) return null;
        const ww = wrapRef.current ? wrapRef.current.clientWidth : W;
        const nb = neighbors[hoverD.id] ? neighbors[hoverD.id].size : 0;
        return <Tip x={P[0] / W * ww} y={P[1] / H * height - 14} w={160}>
          <div style={{ fontWeight: 600, fontSize: 12.5 }}>{hoverD.name}</div>
          <div className="mono" style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>{clusterMeta(hoverD.cluster).label}</div>
          <div className="mono" style={{ fontSize: 10.5 }}>{nb} transfer link{nb !== 1 ? "s" : ""} · read {hoverD.reading3}%</div>
        </Tip>;
      })()}
    </div>
  );
}

export { ChartFrame, ClusterEmbedding, ShapBeeswarm, CorrHeatmap, ScoreHistogram, RadarChart, TrendChart, CauseStream, PeerNetwork, setChartData, divColor, seqColor };
