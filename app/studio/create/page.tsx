"use client"

import { ImageCombiner } from "@/components/image-combiner/index"
import { useStudioContext } from "../layout"

export default function CreatePage() {
  const { apiKey, pendingInputImage, setPendingInputImage } = useStudioContext()

  // Clear pending input after it's been loaded
  const handleInputImageLoaded = () => {
    setPendingInputImage(null)
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 min-h-screen">
      {/* Studio Tab */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-border p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-3rem)]">
        <ImageCombiner 
          apiKey={apiKey} 
          pendingInputImage={pendingInputImage}
          onInputImageLoaded={handleInputImageLoaded}
        />
      </div>
    </div>
  )
}

