"use client"

import { VideoGenerationHistory } from "@/components/dashboard/video-generation-history"

export default function VideoHistoryPage() {
  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen">
      {/* Video History Tab */}
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <VideoGenerationHistory />
      </div>
    </div>
  )
}
