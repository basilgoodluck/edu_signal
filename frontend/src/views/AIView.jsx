import { useEffect, useRef, useState } from "react";
import { getInsights, sendChat } from "../api/ai.js";
import { getDistrictsMap } from "../api/overview.js";
import { subscribeAIChat } from "../api/streams.js";
import { ClusterDot, Icon } from "../components/UI.jsx";
/* EduSignal - AI RAG Insights Panel (right sidebar) */

const AI_CHAT_SEED = [
  { role: "ai", text: "I've analyzed the current district signals and evidence feed. What would you like to explore?" },
];

function FormattedMessage({ text }) {
  return String(text || "").split("\n").map((line, lineIndex) => {
    const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
    return (
      <span key={lineIndex}>
        {lineIndex > 0 && <br />}
        {parts.map((part, partIndex) => (
          part.startsWith("**") && part.endsWith("**")
            ? <strong key={partIndex}>{part.slice(2, -2)}</strong>
            : <span key={partIndex}>{part}</span>
        ))}
      </span>
    );
  });
}

function AIPanel({ onSelectDistrict, onClose, currentDistrict }) {
  const [messages, setMessages] = useState([...AI_CHAT_SEED]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [insights, setInsights] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const byId = Object.fromEntries(districts.map((district) => [district.id, district]));

  useEffect(() => {
    getDistrictsMap().then((response) => setDistricts(response.districts || [])).catch(() => null);
  }, []);

  useEffect(() => {
    getInsights(currentDistrict, 10).then((response) => setInsights(response.items || [])).catch(() => setInsights([]));
  }, [currentDistrict]);

  function handleSend() {
    if (!input.trim() || typing) return;
    const q = input.trim();
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setInput("");
    setTyping(true);
    sendChat({ message: q, conversationId, districtId: currentDistrict }).then((response) => {
      setConversationId(response.conversationId);
      let text = "";
      const cleanup = subscribeAIChat(response.messageId, (event) => {
        if (event.type === "token") {
          text += event.token;
          setMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.id === response.messageId) next[next.length - 1] = { ...last, text };
            else next.push({ id: response.messageId, role: "ai", text });
            return next;
          });
        }
        if (event.type === "done") {
          setMessages(prev => prev.map((message) => message.id === response.messageId ? event.message : message));
          setTyping(false);
          cleanup();
        }
        if (event.type === "error") {
          setMessages(prev => [...prev, { role: "ai", text: event.message || "The chat service failed.", sources: ["AI service"] }]);
          setTyping(false);
          cleanup();
        }
      });
    }).catch((err) => {
      setMessages(prev => [...prev, { role: "ai", text: err.message || "The chat service failed.", sources: ["AI service"] }]);
      setTyping(false);
    });
  }

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, typing]);

  const typeMap = { critical: { c: "var(--bad)", label: "ALERT" }, finding: { c: "var(--brand)", label: "FINDING" }, opportunity: { c: "var(--ok)", label: "OPPORTUNITY" } };

  return (
    <aside style={{ width: 360, flex: "none", borderLeft: "1px solid var(--border)", background: "var(--bg-sunken)", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, var(--brand), var(--c-infra))", display: "grid", placeItems: "center" }}>
            <Icon name="spark" size={15} stroke={2.2} style={{ color: "#fff" }} />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>AI Analyst</div>
            <div className="mono" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.06em" }}>RAG - EVIDENCE-BACKED</div>
          </div>
        </div>
        <button onClick={onClose} style={{ padding: 4 }}><Icon name="close" size={16} stroke={2} style={{ color: "var(--ink-3)" }} /></button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px" }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "var(--ink-faint)", marginBottom: 10 }}>AUTO-GENERATED INSIGHTS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.map(ins => {
              const t = typeMap[ins.type] || typeMap.finding;
              return (
                <div key={ins.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 13px", fontSize: 12.5 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                    <span className="mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: t.c }}>{t.label}</span>
                    {ins.metric && <span className="mono tnum" style={{ fontSize: 11, fontWeight: 700, color: t.c }}>{ins.metric.value}</span>}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, lineHeight: 1.35 }}>{ins.title}</div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>{ins.body}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                    {(ins.sources || []).map(s => (
                      <span key={s} className="mono" style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--ink-3)" }}>{s}</span>
                    ))}
                    {(ins.districts || []).map(did => {
                      const dd = byId[did];
                      return dd ? (
                        <button key={did} onClick={() => onSelectDistrict(did)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "var(--brand-tint)", color: "var(--brand)", fontFamily: "var(--mono)", fontWeight: 600 }}>
                          <ClusterDot cluster={dd.cluster} size={5} />{dd.name}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", flex: 1, display: "flex", flexDirection: "column", minHeight: 200 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "var(--ink-faint)", padding: "12px 14px 6px" }}>ASK THE MODEL</div>
          <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "0 14px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={m.id || i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "92%", padding: "10px 12px", borderRadius: m.role === "user" ? "var(--r) var(--r) 4px var(--r)" : "var(--r) var(--r) var(--r) 4px",
                  background: m.role === "user" ? "var(--brand)" : "var(--surface)",
                  border: m.role === "user" ? "none" : "1px solid var(--border)",
                  color: m.role === "user" ? "#fff" : "var(--ink)",
                  fontSize: 12.5, lineHeight: 1.55,
                }}>
                  <FormattedMessage text={m.text} />
                  {m.sources && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {m.sources.map(s => <span key={s} className="mono" style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 3, background: m.role === "user" ? "rgba(255,255,255,0.15)" : "var(--surface-2)", color: m.role === "user" ? "rgba(255,255,255,0.7)" : "var(--ink-faint)" }}>{s}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", width: "fit-content" }}>
                {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: "var(--ink-faint)", animation: `pulse 1s ease ${i * 0.15}s infinite` }} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} ref={inputRef}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Ask about districts, causes, data..."
            style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--bg)", color: "var(--ink)", fontSize: 12.5, fontFamily: "var(--sans)", outline: "none" }} />
          <button onClick={handleSend} style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--brand)", color: "#fff", fontSize: 12, fontWeight: 600 }}>
            <Icon name="arrow" size={15} stroke={2.5} />
          </button>
        </div>
        <div className="mono" style={{ fontSize: 8.5, color: "var(--ink-faint)", marginTop: 6, textAlign: "center" }}>Evidence-grounded - cites sources</div>
      </div>
    </aside>
  );
}

export { AIPanel };
export default AIPanel;
