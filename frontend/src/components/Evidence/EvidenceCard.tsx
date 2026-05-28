import type { Evidence } from "../../types"

const CLASS_COLORS = {
  Supporting: { bg: "#1D9E7512", border: "#1D9E75", text: "#0F6E56" },
  Contradicting: { bg: "#E24B4A12", border: "#E24B4A", text: "#A32D2D" },
  Irrelevant: { bg: "#88878012", border: "#888780", text: "#5F5E5A" },
}

const SOURCE_LABELS: Record<string, string> = {
  news: "News",
  vacancy_portal: "Vacancy portal",
  forum: "Forum",
  ngo_report: "NGO report",
  grievance_portal: "Grievance portal",
  govt_press_release: "Govt release",
}

interface Props {
  evidence: Evidence
}

export default function EvidenceCard({ evidence }: Props) {
  const style = CLASS_COLORS[evidence.classification] ?? CLASS_COLORS.Irrelevant

  return (
    <div
      style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {evidence.raw_text}
        </p>
        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 500,
            padding: "3px 8px",
            borderRadius: 6,
            background: style.bg,
            border: `0.5px solid ${style.border}`,
            color: style.text,
          }}
        >
          {evidence.classification}
        </span>
      </div>

      <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.5 }}>
        {evidence.reason}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            background: "var(--color-background-secondary)",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          {SOURCE_LABELS[evidence.source_type] ?? evidence.source_type}
        </span>

        {evidence.source_url && (
          <a
            href={evidence.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--color-text-secondary)", textDecoration: "none" }}
          >
            Source ↗
          </a>
        )}
      </div>
    </div>
  )
}