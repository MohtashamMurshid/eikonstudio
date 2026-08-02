"use client"

import { ImageCombiner } from "@/components/image-combiner/index"
import { useStudioContext } from "@/components/studio/studio-layout-client"

export default function CreatePage() {
  const { pendingInputImage, setPendingInputImage } = useStudioContext()

  // Clear pending input after it's been loaded
  const handleInputImageLoaded = () => {
    setPendingInputImage(null)
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen">
      {/* Studio Tab */}
      <div className="bg-card rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <ImageCombiner
          pendingInputImage={pendingInputImage}
          onInputImageLoaded={handleInputImageLoaded}
        />
      </div>
    </div>
  )
}

