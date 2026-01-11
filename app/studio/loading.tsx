import { LogoLoader } from "@/components/logo-icon"

export default function StudioLoading() {
  return (
    <div className="h-screen bg-background flex items-center justify-center">
      <LogoLoader size="lg" text="Loading studio" />
    </div>
  )
}

