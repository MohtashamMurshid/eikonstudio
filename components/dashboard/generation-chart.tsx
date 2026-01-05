"use client"

import { useState, useMemo } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

type TimeRange = "weekly" | "monthly"

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
              {entry.dataKey === "textToImage" ? "Text-to-Image" : "Image Editing"}:
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

  // Fetch real data
  const dailyUsage = useQuery(api.generations.getDailyUsage, { 
    days: timeRange === "weekly" ? 7 : 30 
  })

  // Process data for chart
  const chartData = useMemo(() => {
    if (!dailyUsage) return []

    if (timeRange === "weekly") {
      // Show last 7 days with day names
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      return dailyUsage.slice(-7).map(d => {
        const date = new Date(d.date)
        return {
          name: dayNames[date.getDay()],
          textToImage: d.textToImage,
          imageEditing: d.imageEditing,
          total: d.count,
          cost: d.cost,
        }
      })
    } else {
      // For monthly, group by week or show abbreviated dates
      // Show every 3rd day label to avoid crowding
      return dailyUsage.map((d, index) => {
        const date = new Date(d.date)
        const month = date.toLocaleDateString("en-US", { month: "short" })
        const day = date.getDate()
        return {
          name: index % 3 === 0 ? `${month} ${day}` : "",
          fullDate: `${month} ${day}`,
          textToImage: d.textToImage,
          imageEditing: d.imageEditing,
          total: d.count,
          cost: d.cost,
        }
      })
    }
  }, [dailyUsage, timeRange])

  const totalGenerations = chartData.reduce((sum, item) => sum + item.total, 0)
  const isLoading = !dailyUsage

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
          {(["weekly", "monthly"] as const).map((range) => (
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
          {isLoading ? (
            <span className="inline-block h-7 w-16 bg-gray-100 rounded animate-pulse" />
          ) : (
            <span className="text-2xl font-semibold text-foreground">
              {totalGenerations.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-foreground/30" />
            <span className="text-sm text-foreground/60">Text-to-Image</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-foreground" />
            <span className="text-sm text-foreground/60">Image Editing</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 animate-spin text-foreground/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm text-foreground/50">Loading chart data...</span>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <svg className="w-12 h-12 text-foreground/20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <p className="text-sm text-foreground/50">No generation data yet</p>
              <p className="text-xs text-foreground/40">Start generating images to see your trends</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
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
                dataKey="textToImage" 
                fill="rgba(0,0,0,0.2)" 
                radius={[2, 2, 0, 0]}
                maxBarSize={40}
              />
              <Bar 
                dataKey="imageEditing" 
                fill="rgba(0,0,0,0.8)" 
                radius={[2, 2, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
