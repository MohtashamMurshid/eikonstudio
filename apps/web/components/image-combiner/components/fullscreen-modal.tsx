import type { GeneratedImage } from "../types"

interface FullscreenModalProps {
  showFullscreen: boolean
  generatedImage: GeneratedImage | null
  onClose: () => void
}

export function FullscreenModal({ showFullscreen, generatedImage, onClose }: FullscreenModalProps) {
  if (!showFullscreen || !generatedImage) return null

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 select-none"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/80 hover:bg-black/90 text-white p-2 rounded-full transition-all duration-200"
          title="Close (ESC)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <img
          src={generatedImage.url || "/placeholder.svg"}
          alt="Generated - Fullscreen"
          className="max-w-full max-h-[90vh] object-contain mx-auto rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}

