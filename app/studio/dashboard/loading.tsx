import { LogoLoader } from "@/components/logo-icon"

export default function DashboardLoading() {
  return (
    <div className="min-h-full p-4 flex items-center justify-center">
      <LogoLoader size="md" text="Loading dashboard" />
    </div>
  )
}
