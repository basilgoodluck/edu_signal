import { useState, useEffect, useMemo } from "react";
import config from "../config.js";
import { clusterMeta, ClusterBadge, signed } from "./UI.jsx";
/* EduSignal — India choropleth map (real GeoJSON + fallback) */

/* ---------- CDN URLs to try for India states GeoJSON ---------- */
const GEO_URLS = config.map.geoJsonUrls;

/* ---------- state name → code lookup ---------- */
const SC = {
  "jammu & kashmir":"JK","jammu and kashmir":"JK","himachal pradesh":"HP","punjab":"PB",
  "haryana":"HR","uttarakhand":"UK","uttaranchal":"UK","rajasthan":"RJ","gujarat":"GJ",
  "uttar pradesh":"UP","madhya pradesh":"MP","maharashtra":"MH","bihar":"BR","jharkhand":"JH",
  "west bengal":"WB","chhattisgarh":"CG","chattisgarh":"CG","odisha":"OD","orissa":"OD",
  "karnataka":"KA","telangana":"TS","andhra pradesh":"AP","tamil nadu":"TN","kerala":"KL",
  "goa":"GA","assam":"AS","meghalaya":"ML","arunachal pradesh":"AR","nagaland":"NL",
  "manipur":"MN","mizoram":"MZ","tripura":"TR","sikkim":"SK","delhi":"DL","nct of delhi":"DL",
  "chandigarh":"CH","puducherry":"PY","ladakh":"LA","andaman and nicobar islands":"AN",
  "andaman and nicobar":"AN","lakshadweep":"LD",
  "dadra and nagar haveli and daman and diu":"DD","dadra and nagar haveli":"DD","daman and diu":"DD",
};

function getStateName(p) {
  const keys = ["ST_NM","st_nm","NAME_1","name","Name","NAME","State_Name","state_name","shapeName","shapename","state","State","dtname","NAME_2"];
  for (const k of keys) if (p[k]) return p[k];
  return Object.values(p).find(v => typeof v === "string" && v.length > 2) || "";
}

/* ---------- fallback simplified boundaries ---------- */
const FALLBACK = [
  {id:"JK",n:"Jammu & Kashmir",c:[[73.8,33.5],[75,35.5],[77.5,35.5],[79,33],[78,32],[76,33],[73.8,33.5]]},
  {id:"HP",n:"Himachal Pradesh",c:[[75.5,33],[76.5,33],[77.5,32],[78.5,31.5],[78,31],[77,30.5],[76,31.5],[75.5,32.5],[75.5,33]]},
  {id:"PB",n:"Punjab",c:[[73.8,32],[75.5,32.5],[76,31.5],[76.3,30.3],[75.5,29.8],[74.5,30.2],[73.8,31.5],[73.8,32]]},
  {id:"HR",n:"Haryana",c:[[75.5,29.8],[76.3,30.3],[77,30.5],[77.3,29],[77,28],[76.3,27.5],[75.5,28.5],[75.5,29.8]]},
  {id:"UK",n:"Uttarakhand",c:[[77,30.5],[78,31],[78.5,31.5],[80,30.5],[80,29.2],[78.5,29],[77.3,29],[77,30.5]]},
  {id:"RJ",n:"Rajasthan",c:[[69.5,23.5],[69.5,26],[71,28.5],[73.5,30.2],[75.5,29.8],[75.5,28.5],[76.3,27.5],[77,26.5],[77,25],[76,24],[74,23],[71,22.5],[69.5,23.5]]},
  {id:"GJ",n:"Gujarat",c:[[68.2,23.5],[69.5,23.5],[71,22.5],[74,23],[74.2,22],[73.3,21],[72.5,20.5],[72,21],[70.5,21.5],[69,22],[68.2,23.5]]},
  {id:"UP",n:"Uttar Pradesh",c:[[77,28],[77.3,29],[78.5,29],[80,29.2],[80,30.5],[82,28],[83.5,27.5],[84.5,27],[84.5,26],[84,25.5],[83,25],[82,24],[80.5,24.5],[78.5,24.5],[77.5,25.5],[77,26],[76.5,27],[77,28]]},
  {id:"MP",n:"Madhya Pradesh",c:[[74.2,22],[74,23],[76,24],[77,25],[77.5,25.5],[78.5,24.5],[80.5,24.5],[82,24],[82.5,22.5],[82,22],[80,22],[78,23],[76,23],[74.2,22]]},
  {id:"MH",n:"Maharashtra",c:[[72.5,20.5],[73.3,21],[74.2,22],[76,23],[78,23],[80,22],[80,20],[78.5,19],[76.5,18],[75,17],[73.5,16.5],[73,17.5],[72.8,19],[72.5,20.5]]},
  {id:"BR",n:"Bihar",c:[[83,27.5],[84.5,27],[86,27],[87.5,27],[88.2,26.2],[87.5,24.5],[86,24],[84.5,24.5],[84,25.5],[83,25.5],[83,27.5]]},
  {id:"JH",n:"Jharkhand",c:[[83,25.5],[84,25.5],[84.5,24.5],[86,24],[87.5,23],[87,22.5],[85.5,22.5],[84,23],[82.5,22.5],[82,24],[83,25.5]]},
  {id:"WB",n:"West Bengal",c:[[87.5,27],[88.5,27.5],[89,26.5],[88.8,25],[88.5,24],[88,22],[87.5,21.5],[87,22],[86.5,22],[87,22.5],[87.5,23],[87,24.5],[87.5,25],[87.5,27]]},
  {id:"CG",n:"Chhattisgarh",c:[[80,22],[82,22],[82.5,22.5],[84,23],[84,21.5],[83,19.5],[82,18.5],[81,18.5],[80,20],[80,22]]},
  {id:"OD",n:"Odisha",c:[[81,18.5],[82,18.5],[83,18],[84,19],[85.5,22.5],[86.5,22],[87,22],[87,21.5],[86,20],[84.5,19],[83,18],[81.5,18],[81,18.5]]},
  {id:"KA",n:"Karnataka",c:[[74,16.5],[75,17],[76.5,18],[78.5,19],[78.5,16],[78,14.5],[77.8,12.5],[76.5,12],[75,12.5],[74.5,14],[74,16.5]]},
  {id:"TS",n:"Telangana",c:[[77,17],[78.5,19],[80,20],[80.5,19],[80,17.5],[79,16.5],[78,15.5],[77,16.5],[77,17]]},
  {id:"AP",n:"Andhra Pradesh",c:[[77,16.5],[78,15.5],[79,16.5],[80,17.5],[80.5,19],[82,18.5],[83,18],[84.5,17],[83,15],[81,14],[80,13.5],[79,14],[78,14.5],[77,16.5]]},
  {id:"TN",n:"Tamil Nadu",c:[[76.5,12],[77.8,12.5],[78,14.5],[79,14],[80,13.5],[80,12],[79.5,10],[78.5,9],[77.5,8],[77,8.5],[76.5,10],[76,11.5],[76.5,12]]},
  {id:"KL",n:"Kerala",c:[[75,12.5],[76,11.5],[76.5,10],[77,8.5],[76.5,8.5],[75.5,9.5],[75,11],[74.8,12],[75,12.5]]},
  {id:"GA",n:"Goa",c:[[73.5,15.8],[74,16.5],[74.5,15.3],[74,15],[73.5,15.5],[73.5,15.8]]},
  {id:"AS",n:"Assam",c:[[89.5,26.5],[91,26.5],[93,27],[95.5,27.5],[96,27],[95,26],[93,25.5],[92,25.5],[90.5,26],[89.5,26],[89.5,26.5]]},
  {id:"ML",n:"Meghalaya",c:[[89.5,26],[90.5,26],[92,25.5],[92,25],[90,25.2],[89.5,25.5],[89.5,26]]},
  {id:"AR",n:"Arunachal Pradesh",c:[[91.5,27.5],[93,29],[95.5,29],[97,28],[97,27],[95.5,27.5],[93,27],[91.5,27.5]]},
  {id:"NL",n:"Nagaland",c:[[93.5,27],[95,27],[95.5,26],[94.5,25.5],[93.5,26],[93.5,27]]},
  {id:"MN",n:"Manipur",c:[[93,25.5],[94,26],[94.5,25.5],[94.5,24.5],[93.5,24],[93,25],[93,25.5]]},
  {id:"MZ",n:"Mizoram",c:[[92,24.5],[93,24],[93.5,23],[93,22],[92.5,22],[92,23],[92,24.5]]},
  {id:"TR",n:"Tripura",c:[[91,24.5],[91.5,25],[92,24.5],[92,23],[91.5,22.5],[91,23.5],[91,24.5]]},
  {id:"SK",n:"Sikkim",c:[[88,27.5],[88.5,28],[89,27.5],[88.8,27],[88.2,27],[88,27.5]]},
];

/* ---------- Mercator projection ---------- */
const MB = { lngMin: 67, lngMax: 98, latMin: 6.5, latMax: 37 };
const YMN = Math.log(Math.tan(Math.PI / 4 + (MB.latMin * Math.PI / 180) / 2));
const YMX = Math.log(Math.tan(Math.PI / 4 + (MB.latMax * Math.PI / 180) / 2));

function proj(lng, lat, W, H, P) {
  const x = P + ((lng - MB.lngMin) / (MB.lngMax - MB.lngMin)) * (W - 2 * P);
  const my = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const y = P + ((YMX - my) / (YMX - YMN)) * (H - 2 * P);
  return [x, y];
}

function polyPath(coords, W, H, P) {
  return coords.map((pt, i) => {
    const [x, y] = proj(pt[0], pt[1], W, H, P);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + " Z";
}

/* convert GeoJSON geometry to SVG path */
function geoToPath(geom, W, H, P) {
  const ring = (coords) => coords.map((pt, i) => {
    const [x, y] = proj(pt[0], pt[1], W, H, P);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + " Z";

  if (geom.type === "Polygon") return geom.coordinates.map(ring).join(" ");
  if (geom.type === "MultiPolygon") return geom.coordinates.flatMap(p => p.map(ring)).join(" ");
  return "";
}

/* ---------- Choropleth map component ---------- */
function DistrictMap({ districts, selected, onSelect, filterCluster }) {
  const W = 760, H = 720, PAD = 24;
  const [hover, setHover] = useState(null);
  const [hoverState, setHoverState] = useState(null);
  const [geoLoaded, setGeoLoaded] = useState(null); // null = loading, array = loaded, false = failed
  const byId = useMemo(() => Object.fromEntries((districts || []).map((d) => [d.id, d])), [districts]);

  /* fetch real GeoJSON on mount */
  useEffect(() => {
    let dead = false;
    (async () => {
      for (const url of GEO_URLS) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const data = await r.json();
          if (dead) return;
          const feats = data.type === "FeatureCollection" ? data.features : data.type === "Feature" ? [data] : [];
          const states = feats.map(f => {
            const nm = getStateName(f.properties || {});
            const code = SC[nm.toLowerCase().trim()] || "";
            return { id: code, n: nm, d: geoToPath(f.geometry, W, H, PAD) };
          }).filter(s => s.d && s.d.length > 10);
          if (states.length >= 10) { setGeoLoaded(states); return; }
        } catch (e) { /* try next */ }
      }
      if (!dead) setGeoLoaded(false);
    })();
    return () => { dead = true; };
  }, []);

  /* dominant cluster per state */
  const stateInfo = useMemo(() => {
    const m = {};
    (districts || []).forEach(d => {
      if (!m[d.stateCode]) m[d.stateCode] = { clusters: {}, districts: [], total: 0 };
      m[d.stateCode].clusters[d.cluster] = (m[d.stateCode].clusters[d.cluster] || 0) + 1;
      m[d.stateCode].districts.push(d);
      m[d.stateCode].total++;
    });
    Object.entries(m).forEach(([, info]) => {
      info.dominant = Object.entries(info.clusters).sort((a, b) => b[1] - a[1])[0][0];
      info.avgReading = Math.round(info.districts.reduce((s, d) => s + d.reading3, 0) / info.total);
    });
    return m;
  }, [districts]);

  /* resolve state paths */
  const statePaths = useMemo(() => {
    if (geoLoaded && geoLoaded.length) return geoLoaded;
    return FALLBACK.map(s => ({ ...s, d: polyPath(s.c, W, H, PAD) }));
  }, [geoLoaded]);

  const sel = selected ? byId[selected] : null;
  const hoverD = hover ? byId[hover] : null;
  const peerLines = sel ? (sel.peers || []).map(pid => byId[pid]).filter(Boolean) : [];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", fontFamily: "var(--mono)" }}>

        <defs>
          <filter id="mglow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>

        {/* subtle grid dots */}
        {Array.from({ length: 16 }, (_, i) => Array.from({ length: 12 }, (_, j) => (
          <circle key={`g${i}-${j}`} cx={24 + i * 46} cy={24 + j * 58} r="0.5" fill="var(--border)" opacity="0.25" />
        )))}

        {/* state polygons — choropleth fill */}
        {statePaths.map((state, idx) => {
          const info = stateInfo[state.id];
          const hasData = !!info;
          const isHov = hoverState === state.id;
          const meta = hasData ? clusterMeta(info.dominant) : null;
          const dimmed = filterCluster && hasData && info.dominant !== filterCluster;
          const dimmedNoData = filterCluster && !hasData;

          let fill, stroke, sw;
          if (hasData) {
            fill = isHov ? `color-mix(in oklch, ${meta.color} 35%, var(--surface))` : meta.tint;
            stroke = dimmed ? "var(--border)" : meta.color;
            sw = isHov ? 2 : 1.2;
          } else {
            fill = "var(--surface)";
            stroke = "var(--border)";
            sw = 0.6;
          }

          return (
            <path key={state.id + "-" + idx} d={state.d} fill={fill} stroke={stroke} strokeWidth={sw}
              opacity={dimmed || dimmedNoData ? 0.2 : hasData ? 1 : 0.4} strokeLinejoin="round"
              style={{ transition: "all 0.2s ease", cursor: hasData ? "pointer" : "default" }}
              onMouseEnter={() => hasData && setHoverState(state.id)}
              onMouseLeave={() => setHoverState(null)} />
          );
        })}

        {/* peer connector lines */}
        {sel && peerLines.map(p => {
          const [x1, y1] = proj(sel.lng, sel.lat, W, H, PAD);
          const [x2, y2] = proj(p.lng, p.lat, W, H, PAD);
          return <line key={"pl" + p.id} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={clusterMeta(sel.cluster).color} strokeWidth="1.5" strokeDasharray="4 6" opacity="0.55" />;
        })}

        {/* district glow halos */}
        {districts.map(d => {
          const [x, y] = proj(d.lng, d.lat, W, H, PAD);
          const m = clusterMeta(d.cluster);
          const dim = filterCluster && filterCluster !== d.cluster;
          return <circle key={"gl-" + d.id} cx={x} cy={y} r={18} fill={m.color}
            opacity={dim ? 0.02 : 0.18} filter="url(#mglow)" style={{ transition: "opacity 0.2s" }} />;
        })}

        {/* district markers */}
        {districts.map(d => {
          const [x, y] = proj(d.lng, d.lat, W, H, PAD);
          const m = clusterMeta(d.cluster);
          const isSel = d.id === selected, isHov = d.id === hover;
          const dim = filterCluster && filterCluster !== d.cluster;
          const r = 5 + (40 - d.reading3) / 5;

          return (
            <g key={d.id} transform={`translate(${x},${y})`}
              style={{ cursor: "pointer", opacity: dim ? 0.12 : 1, transition: "opacity 0.2s" }}
              onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(d.id)}>
              {(isSel || isHov) && <circle r={r + 10} fill={m.color} opacity="0.12" />}
              {isSel && <circle r={r + 6} fill="none" stroke={m.color} strokeWidth="2" style={{ animation: "pulse 2s ease infinite" }} />}
              <circle r={r} fill={m.color} stroke="var(--bg)" strokeWidth="2"
                style={{ filter: isSel || isHov ? "brightness(1.2) saturate(1.15)" : "none" }} />
              {d.featured && <circle r={2.2} fill="var(--bg)" />}
              {(isHov || isSel) && (
                <text y={-r - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink)"
                  style={{ fontFamily: "var(--sans)", textShadow: "0 1px 6px var(--bg), 0 0 12px var(--bg)" }}>
                  {d.name}
                </text>
              )}
            </g>
          );
        })}

        {/* loading indicator */}
        {geoLoaded === null && (
          <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="9" fill="var(--ink-faint)"
            style={{ animation: "pulse 1.5s ease infinite" }}>Loading map boundaries…</text>
        )}
      </svg>

      {/* district hover tooltip */}
      {hoverD && hoverD.id !== selected && (
        <div style={{
          position: "absolute", top: 14, left: 14, pointerEvents: "none",
          background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r)",
          padding: "12px 14px", boxShadow: "var(--shadow-lg)", minWidth: 180, animation: "fadeIn 0.12s ease",
        }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{hoverD.name}</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginBottom: 8 }}>{hoverD.state}</div>
          <ClusterBadge cluster={hoverD.cluster} size="sm" />
          <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
            <div>
              <div className="mono tnum" style={{ fontSize: 17, fontWeight: 600 }}>{hoverD.reading3}%</div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>READ G3</div>
            </div>
            <div>
              <div className="mono tnum" style={{ fontSize: 17, fontWeight: 600, color: hoverD.yoyReading < 0 ? "var(--bad)" : "var(--ok)" }}>{signed(hoverD.yoyReading)}</div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>YoY</div>
            </div>
          </div>
        </div>
      )}

      {/* state hover tooltip */}
      {hoverState && !hoverD && stateInfo[hoverState] && (() => {
        const si = stateInfo[hoverState];
        const sObj = statePaths.find(s => s.id === hoverState);
        return (
          <div style={{
            position: "absolute", bottom: 14, left: 14, pointerEvents: "none",
            background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r)",
            padding: "11px 14px", boxShadow: "var(--shadow-lg)", minWidth: 170, animation: "fadeIn 0.1s ease",
          }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{sObj?.n || hoverState}</div>
            <div style={{ marginTop: 6 }}><ClusterBadge cluster={si.dominant} size="sm" /></div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div>
                <div className="mono tnum" style={{ fontSize: 15, fontWeight: 600 }}>{si.total}</div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>DISTRICTS</div>
              </div>
              <div>
                <div className="mono tnum" style={{ fontSize: 15, fontWeight: 600 }}>{si.avgReading}%</div>
                <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>AVG READ</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export { DistrictMap };
export default DistrictMap;
