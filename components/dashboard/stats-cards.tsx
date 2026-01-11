"use client"

import { useQuery } from "convex-helpers/react/cache/hooks"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useEffect, useState } from "react"

interface StatsCardsProps {
  userName?: string
}

function MiniBarChart({ data, color = "black" }: { data: number[], color?: string }) {
  const max = Math.max(...data, 1) // Ensure max is at least 1 to avoid division by zero
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
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`
  }
  if (cost < 1) {
    return `$${cost.toFixed(2)}`
  }
  return `$${cost.toFixed(2)}`
}

export function StatsCards({ userName }: StatsCardsProps) {
  const [hasBackfilled, setHasBackfilled] = useState(false)
  
  // Fetch real analytics data
  const usageStats = useQuery(api.generations.getUsageStats, {})
  const usageTrends = useQuery(api.generations.getUsageTrends, {})
  const dailyUsage = useQuery(api.generations.getDailyUsage, { days: 10 })
  const backfillCosts = useMutation(api.generations.backfillCosts)

  // Auto-backfill costs for existing generations (once)
  useEffect(() => {
    if (!hasBackfilled && usageStats && usageStats.totalGenerations > 0) {
      backfillCosts({}).then(() => setHasBackfilled(true)).catch(() => {})
    }
  }, [usageStats, hasBackfilled])

  // Generate sparkline data from daily usage
  const generationsSparkline = dailyUsage?.slice(-10).map(d => d.count) || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const costSparkline = dailyUsage?.slice(-10).map(d => d.cost * 1000) || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Scale up for visibility

  const isLoading = !usageStats || !usageTrends

  return (
    <div className="space-y-6">
      {/* Header - Gallery style */}
      <div>
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="flex items-center gap-1.5 px-2 py-1 text-foreground font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </span>
        </nav>
        <p className="text-sm text-foreground/50 mt-1">
          {userName ? `Welcome back, ${userName.split(" ")[0]}` : "Your usage overview"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Images Generated */}
        <div className="bg-card rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">
                Images Generated
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
                <div className={`w-5 h-5 rounded-full ${usageTrends.generationsTrend >= 0 ? "bg-emerald-100" : "bg-red-100"} flex items-center justify-center`}>
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
                <span className={`text-sm font-medium ${usageTrends.generationsTrend >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {usageTrends.generationsTrend >= 0 ? "+" : ""}{usageTrends.generationsTrend}%
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
                  <span className="text-lg font-normal text-foreground/50 ml-1">images</span>
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-xs text-foreground/50">Text-to-Image</div>
              <div className="text-sm font-medium text-foreground">{usageStats?.textToImage || 0}</div>
              <div className="text-xs text-foreground/50">Image Editing</div>
              <div className="text-sm font-medium text-foreground">{usageStats?.imageEditing || 0}</div>
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
                <span className="text-sm text-foreground/50">
                  Last month: {usageStats.lastMonth.generations} images
                </span>
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
            <MiniBarChart data={costSparkline} color="#059669" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            {isLoading ? (
              <div className="h-5 w-32 bg-secondary rounded animate-pulse" />
            ) : (
              <>
                <div className={`w-5 h-5 rounded-full ${usageTrends.costTrend >= 0 ? "bg-amber-100" : "bg-emerald-100"} flex items-center justify-center`}>
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
                <span className="text-sm text-foreground/50">
                  This month: {formatCost(usageStats.thisMonth.cost)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
