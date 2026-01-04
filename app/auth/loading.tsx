import { LogoLoader } from "@/components/logo-icon"

export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fafaf8] to-[#f0f0ec] flex items-center justify-center">
      <LogoLoader size="lg" text="Loading" />
    </div>
  )
}

