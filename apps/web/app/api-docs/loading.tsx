import { LogoLoader } from "@/components/logo-icon"

export default function Loading() {
  return (
    <div className="h-screen bg-background flex items-center justify-center select-none">
      <LogoLoader size="lg" text="Loading API Docs" />
    </div>
  )
}

