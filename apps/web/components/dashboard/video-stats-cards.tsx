"use client"

import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"

interface VideoStatsCardsProps {
  userName?: string
}

function MiniBarChart({ data, color = "black" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((value, index) => (
        <div
          key={index}
          className="w-1.5 rounded-sm transition-all"
          style={{
            height: `${(value / max) * 100}%`,
            backgroundColor: color,
            opacity: 0.3 + (index / data.length) * 0.7,
          }}
        />
      ))}
    </div>
  )
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(2)}`
  return `$${cost.toFixed(2)}`
}

export function VideoStatsCards({ userName }: VideoStatsCardsProps) {
  const usageStats = useQuery(api.videoGenerations.getVideoUsageStats, {})
  const usageTrends = useQuery(api.videoGenerations.getVideoUsageTrends, {})
  const dailyUsage = useQuery(api.videoGenerations.getVideoDailyUsage, { days: 10 })

  const generationsSparkline =
    dailyUsage?.slice(-10).map((d) => d.count) || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const costSparkline =
    dailyUsage?.slice(-10).map((d) => d.cost * 1000) || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

  const isLoading = !usageStats || !usageTrends

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="flex items-center gap-1.5 px-2 py-1 text-foreground font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            Video usage
          </span>
        </nav>
        <p className="text-sm text-foreground/50 mt-1">
          {userName ? `${userName.split(" ")[0]}'s video generation overview` : "Your video usage overview"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Videos Generated */}
        <div className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">
                Videos Generated
              </p>
              {isLoading ? (
                <div className="h-9 w-24 bg-secondary rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-semibold text-foreground tracking-tight">
                  {usageStats.totalGenerations.toLocaleString()}
                </p>
              )}
            </div>
            <MiniBarChart data={generationsSparkline} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            {isLoading ? (
              <div className="h-5 w-32 bg-secondary rounded animate-pulse" />
            ) : (
              <>
                <div
                  className={`w-5 h-5 rounded-full ${
                    usageTrends.generationsTrend >= 0 ? "bg-emerald-100" : "bg-red-100"
                  } flex items-center justify-center`}
                >
                  {usageTrends.generationsTrend >= 0 ? (
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    usageTrends.generationsTrend >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {usageTrends.generationsTrend >= 0 ? "+" : ""}
                  {usageTrends.generationsTrend}%
                </span>
                <span className="text-sm text-foreground/50">vs last month</span>
              </>
            )}
          </div>
        </div>

        {/* This Month */}
        <div className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">
                This Month
              </p>
              {isLoading ? (
                <div className="h-9 w-24 bg-secondary rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-semibold text-foreground tracking-tight">
                  {usageStats.thisMonth.generations.toLocaleString()}
                  <span className="text-lg font-normal text-foreground/50 ml-1">videos</span>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-xs text-foreground/50">Text-to-Video</div>
              <div className="text-sm font-medium text-foreground">{usageStats?.textToVideo || 0}</div>
              <div className="text-xs text-foreground/50">Image-to-Video</div>
              <div className="text-sm font-medium text-foreground">{usageStats?.imageToVideo || 0}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            {isLoading ? (
              <div className="h-5 w-32 bg-secondary rounded animate-pulse" />
            ) : (
              <>
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-sm text-foreground/50">Last month: {usageStats.lastMonth.generations} videos</span>
              </>
            )}
          </div>
        </div>

        {/* Estimated Cost */}
        <div className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">
                Estimated Cost
              </p>
              {isLoading ? (
                <div className="h-9 w-24 bg-secondary rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-semibold text-foreground tracking-tight">
                  {formatCost(usageStats.totalCost)}
                  <span className="text-lg font-normal text-foreground/50 ml-1">total</span>
                </p>
              )}
            </div>
            <MiniBarChart data={costSparkline} color="#f59e0b" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            {isLoading ? (
              <div className="h-5 w-32 bg-secondary rounded animate-pulse" />
            ) : (
              <>
                <div
                  className={`w-5 h-5 rounded-full ${
                    usageTrends.costTrend >= 0 ? "bg-amber-100" : "bg-emerald-100"
                  } flex items-center justify-center`}
                >
                  {usageTrends.costTrend >= 0 ? (
                    <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-foreground/50">This month: {formatCost(usageStats.thisMonth.cost)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

