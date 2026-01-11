import { LogoLoader } from "@/components/logo-icon"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LogoLoader size="lg" text="Loading" />
    </div>
  )
}

