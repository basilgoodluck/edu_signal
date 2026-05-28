import { useState } from "react"
import type { Evidence } from "../../types"
import EvidenceCard from "./EvidenceCard"

type Filter = "All" | "Supporting" | "Contradicting" | "Irrelevant"

const TABS: Filter[] = ["All", "Supporting", "Contradicting", "Irrelevant"]

interface Props {
  evidence: Evidence[]
}

export default function EvidenceList({ evidence }: Props) {
  const [filter, setFilter] = useState<Filter>("All")

  const filtered = filter === "All" ? evidence : evidence.filter((e) => e.classification === filter)

  const counts = {
    All: evidence.length,
    Supporting: evidence.filter((e) => e.classification === "Supporting").length,
    Contradicting: evidence.filter((e) => e.classification === "Contradicting").length,
    Irrelevant: evidence.filter((e) => e.classification === "Irrelevant").length,
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "0.5px solid var(--color-border-tertiary)",
              background: filter === tab ? "var(--color-background-secondary)" : "transparent",
              fontSize: 12,
              color: filter === tab ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontWeight: filter === tab ? 500 : 400,
              cursor: "pointer",
            }}
          >
            {tab}
            <span
              style={{
                marginLeft: 5,
                fontSize: 11,
                color: "var(--color-text-tertiary)",
              }}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>No evidence found.</p>
      ) : (
        filtered.map((e) => <EvidenceCard key={e.id} evidence={e} />)
      )}
    </div>
  )
}