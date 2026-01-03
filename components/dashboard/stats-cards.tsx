"use client"

interface StatsCardsProps {
  userName?: string
}

// Mini bar chart data for sparklines
const revenueSparkline = [2, 4, 3, 5, 4, 6, 5, 7, 6, 8]
const ordersSparkline = [3, 2, 4, 3, 5, 4, 6, 5, 7, 6]
const customersSparkline = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6]

function MiniBarChart({ data, color = "black" }: { data: number[], color?: string }) {
  const max = Math.max(...data)
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

export function StatsCards({ userName }: StatsCardsProps) {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      {userName && (
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back, {userName.split(" ")[0]}
          </h1>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Images Generated */}
        <div className="bg-white rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">
                Images Generated
              </p>
              <p className="text-3xl font-semibold text-foreground tracking-tight">
                2,847
              </p>
            </div>
            <MiniBarChart data={revenueSparkline} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <span className="text-sm text-emerald-600 font-medium">+12.5%</span>
            <span className="text-sm text-foreground/50">vs last month</span>
          </div>
        </div>

        {/* API Calls */}
        <div className="bg-white rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">
                API Calls
              </p>
              <p className="text-3xl font-semibold text-foreground tracking-tight">
                8,429
                <span className="text-lg font-normal text-foreground/50 ml-1">calls</span>
              </p>
            </div>
            <MiniBarChart data={ordersSparkline} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
            <span className="text-sm text-emerald-600 font-medium">+8.2%</span>
            <span className="text-sm text-foreground/50">vs last month</span>
          </div>
        </div>

        {/* Credits Used */}
        <div className="bg-white rounded-2xl border border-border p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-1">
                Credits Remaining
              </p>
              <p className="text-3xl font-semibold text-foreground tracking-tight">
                1,205
                <span className="text-lg font-normal text-foreground/50 ml-1">credits</span>
              </p>
            </div>
            <MiniBarChart data={customersSparkline} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <span className="text-sm text-amber-600 font-medium">-24.3%</span>
            <span className="text-sm text-foreground/50">used this month</span>
          </div>
        </div>
      </div>
    </div>
  )
}

