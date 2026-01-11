import { LogoLoader } from "@/components/logo-icon"

export default function BrandLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LogoLoader size="lg" text="Loading brand assets" />
    </div>
  )
}
