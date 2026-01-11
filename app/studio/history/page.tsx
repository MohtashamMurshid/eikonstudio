"use client"

import { useRouter } from "next/navigation"
import { GenerationHistory } from "@/components/dashboard/generation-history"
import { useStudioContext } from "../layout"

export default function HistoryPage() {
  const router = useRouter()
  const { setPendingInputImage } = useStudioContext()

  // Handle using a history image as input
  const handleUseAsInput = (imageData: string) => {
    setPendingInputImage(imageData)
    router.push("/studio/create")
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen">
      {/* History Tab */}
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <GenerationHistory onUseAsInput={handleUseAsInput} />
      </div>
    </div>
  )
}

