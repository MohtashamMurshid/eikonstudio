"use client"

import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { GenerationChart } from "@/components/dashboard/generation-chart"

export default function DashboardPage() {
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)
  
  const displayName = user?.name || session?.user?.name || "User"

  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen">
      <div className="bg-white rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <div className="space-y-6">
          {/* Stats Cards with Welcome */}
          <StatsCards userName={displayName} />

          {/* Generation Chart */}
          <GenerationChart />
        </div>
      </div>
    </div>
  )
}

