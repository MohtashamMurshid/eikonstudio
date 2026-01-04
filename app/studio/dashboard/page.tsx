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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Stats Cards with Welcome */}
      <StatsCards userName={displayName} />

      {/* Generation Chart */}
      <GenerationChart />
    </div>
  )
}

