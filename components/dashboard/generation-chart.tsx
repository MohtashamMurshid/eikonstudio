"use client"

import { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

type TimeRange = "weekly" | "monthly" | "yearly"

// Monthly data for the chart
const monthlyData = [
  { name: "Jan", newGenerations: 120, edits: 45 },
  { name: "Feb", newGenerations: 180, edits: 65 },
  { name: "Mar", newGenerations: 250, edits: 90 },
  { name: "Apr", newGenerations: 310, edits: 120 },
  { name: "May", newGenerations: 420, edits: 180 },
  { name: "Jun", newGenerations: 580, edits: 220 },
  { name: "Jul", newGenerations: 490, edits: 195 },
  { name: "Aug", newGenerations: 620, edits: 280 },
  { name: "Sep", newGenerations: 550, edits: 240 },
  { name: "Oct", newGenerations: 680, edits: 310 },
  { name: "Nov", newGenerations: 720, edits: 340 },
  { name: "Dec", newGenerations: 850, edits: 380 },
]

const weeklyData = [
  { name: "Mon", newGenerations: 45, edits: 18 },
  { name: "Tue", newGenerations: 62, edits: 24 },
  { name: "Wed", newGenerations: 78, edits: 32 },
  { name: "Thu", newGenerations: 55, edits: 22 },
  { name: "Fri", newGenerations: 89, edits: 38 },
  { name: "Sat", newGenerations: 42, edits: 15 },
  { name: "Sun", newGenerations: 35, edits: 12 },
]

const yearlyData = [
  { name: "2020", newGenerations: 1200, edits: 450 },
  { name: "2021", newGenerations: 2400, edits: 890 },
  { name: "2022", newGenerations: 4800, edits: 1800 },
  { name: "2023", newGenerations: 8200, edits: 3200 },
  { name: "2024", newGenerations: 12500, edits: 5100 },
  { name: "2025", newGenerations: 15800, edits: 6400 },
]

const dataByRange: Record<TimeRange, typeof monthlyData> = {
  weekly: weeklyData,
  monthly: monthlyData,
  yearly: yearlyData,
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border rounded-lg shadow-lg p-3">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-2 h-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground/60">
              {entry.dataKey === "newGenerations" ? "New" : "Edits"}:
            </span>
            <span className="font-medium text-foreground">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function GenerationChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>("monthly")

  const data = dataByRange[timeRange]
  const totalGenerations = data.reduce((sum, item) => sum + item.newGenerations + item.edits, 0)

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground/50 uppercase tracking-wider">
            Generation Trend
          </h3>
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center cursor-help" title="Track your image generation activity over time">
            <svg className="w-3 h-3 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Time Range Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {(["weekly", "monthly", "yearly"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? "bg-white text-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-6 mb-6">
        <div>
          <span className="text-sm text-foreground/50">Total: </span>
          <span className="text-2xl font-semibold text-foreground">
            {totalGenerations.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-foreground/30" />
            <span className="text-sm text-foreground/60">New Generations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-foreground" />
            <span className="text-sm text-foreground/60">Edits/Variations</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            barGap={2}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke="#e5e5e5"
            />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#666", fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#666", fontSize: 12 }}
              tickFormatter={(value) => {
                if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
                return value
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar 
              dataKey="newGenerations" 
              fill="rgba(0,0,0,0.2)" 
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
            />
            <Bar 
              dataKey="edits" 
              fill="rgba(0,0,0,0.8)" 
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

