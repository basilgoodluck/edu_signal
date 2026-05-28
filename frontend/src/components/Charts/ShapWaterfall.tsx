import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell, ResponsiveContainer } from "recharts"

interface Props {
  shapValues: Record<string, number>
}

const FEATURE_LABELS: Record<string, string> = {
  ndvi_seasonal_variance: "NDVI seasonal variance",
  news_migration_signal: "Migration news signal",
  news_flood_signal: "Flood news signal",
  teacher_vacancy_rate: "Teacher vacancy rate",
  ptr: "Pupil-teacher ratio",
  infrastructure_score: "Infrastructure score",
  reading_grade3_pct: "Grade 3 reading",
  arithmetic_grade5_pct: "Grade 5 arithmetic",
  yoy_delta_reading: "Reading delta YoY",
  gender_gap_reading: "Gender gap reading",
  flood_days_per_year_avg: "Flood days/year",
  road_connectivity_index: "Road connectivity",
  vacancy_portal_open_posts: "Open vacancies",
  forum_absenteeism_complaints: "Absenteeism complaints",
}

export default function ShapWaterfall({ shapValues }: Props) {
  const data = Object.entries(shapValues)
    .map(([key, value]) => ({
      feature: FEATURE_LABELS[key] ?? key,
      value: parseFloat(value.toFixed(3)),
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8)

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 160, bottom: 4 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="feature"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            axisLine={false}
            tickLine={false}
            width={155}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [v.toFixed(3), "SHAP value"]}
          />
          <ReferenceLine x={0} stroke="var(--color-border-secondary)" strokeWidth={0.5} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.value >= 0 ? "#1D9E75" : "#E24B4A"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}