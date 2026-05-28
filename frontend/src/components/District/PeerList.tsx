import type { District } from "../../types"

interface Props {
  peers: District[]
  onSelect: (id: string) => void
}

export default function PeerList({ peers, onSelect }: Props) {
  if (!peers.length) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {peers.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p.id)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 8,
            border: "0.5px solid var(--color-border-tertiary)",
            background: "var(--color-background-primary)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {p.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
              {p.state}
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>→</span>
        </button>
      ))}
    </div>
  )
}