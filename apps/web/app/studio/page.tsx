"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LogoLoader } from "@/components/logo-icon"

export default function StudioPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to /studio/create as the default studio page
    router.replace("/studio/create")
  }, [router])

  // Show loading while redirecting
  return (
    <div className="h-screen bg-background flex items-center justify-center select-none">
      <LogoLoader size="lg" text="Loading Studio" />
    </div>
  )
}
