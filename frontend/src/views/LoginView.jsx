import { useState } from "react";
import config from "../config.js";
import { Button, Card } from "../components/UI.jsx";

function initialsFor(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function LoginView({ onLogin }) {
  const [name, setName] = useState(config.user.defaultName);
  const [role, setRole] = useState(config.user.defaultRole);
  const [password, setPassword] = useState(config.user.defaultPassword);

  function submit(event) {
    event.preventDefault();
    if (!name.trim() || !role.trim() || !password.trim()) return;
    const user = { name: name.trim(), role: role.trim(), initials: initialsFor(name) };
    localStorage.setItem(config.auth.tokenKey, JSON.stringify(user));
    onLogin(user);
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", padding: 24 }}>
      <Card style={{ width: "min(420px, 100%)" }}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em" }}>EduSignal</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.12em", marginTop: 4 }}>ROOT-CAUSE INTEL</div>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "10px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--sans)" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>
            Role
            <input value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: "10px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--sans)" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-2)", fontWeight: 600 }}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: "10px 12px", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--sans)" }} />
          </label>
          <Button variant="primary" icon="arrow" style={{ justifyContent: "center", marginTop: 4 }}>Enter dashboard</Button>
        </form>
      </Card>
    </div>
  );
}

export default LoginView;
