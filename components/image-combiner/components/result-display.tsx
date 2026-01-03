import { Button } from "@/components/ui/button"
import { ProgressBar } from "./progress-bar"
import type { GeneratedImage } from "../types"

interface ResultDisplayProps {
  isLoading: boolean
  isConvertingHeic: boolean
  heicProgress: number
  progress: number
  generatedImage: GeneratedImage | null
  imageLoaded: boolean
  onOpenFullscreen: () => void
  onUseAsInput: () => void
  onCopy: () => void
  onDownload: () => void
}

export function ResultDisplay({
  isLoading,
  isConvertingHeic,
  heicProgress,
  progress,
  generatedImage,
  imageLoaded,
  onOpenFullscreen,
  onUseAsInput,
  onCopy,
  onDownload,
}: ResultDisplayProps) {
  return (
    <div className="space-y-4 md:space-y-8 select-none">
      <div className="flex items-center justify-between">
        <h3 className="text-sm md:text-lg font-semibold flex items-center gap-2 text-white">
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21,15 16,10 5,21" />
          </svg>
          Result
        </h3>
        {generatedImage && (
          <div className="flex gap-1 md:gap-2">
            <Button
              onClick={onUseAsInput}
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2 bg-transparent border-gray-600 text-white hover:bg-gray-700 flex items-center gap-1"
              title="Use as Input"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="hidden sm:inline">Use as Input</span>
            </Button>
            <Button
              onClick={onCopy}
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2 bg-transparent border-gray-600 text-white hover:bg-gray-700 flex items-center gap-1"
              title="Copy"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2H5z" />
              </svg>
              <span className="hidden sm:inline">Copy</span>
            </Button>
            <Button
              onClick={onDownload}
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2 bg-transparent border-gray-600 text-white hover:bg-gray-700 flex items-center gap-1"
              title="Download"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center h-48 md:h-80">
        {isLoading ? (
          <ProgressBar progress={progress} />
        ) : isConvertingHeic ? (
          <ProgressBar progress={heicProgress} label="Converting HEIC image..." />
        ) : generatedImage ? (
          <div className="w-full h-full flex flex-col select-none">
            <div className="flex-1 flex items-center justify-center max-h-36 md:max-h-64 relative group">
              <img
                src={generatedImage.url || "/placeholder.svg"}
                alt="Generated"
                className={`max-w-full max-h-full object-contain rounded transition-opacity duration-500 ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  transform: imageLoaded ? "scale(1)" : "scale(1.05)",
                  transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
                }}
                onClick={onOpenFullscreen}
              />
              <button
                onClick={onOpenFullscreen}
                className="absolute top-1 right-1 md:top-2 md:right-2 bg-black/70 hover:bg-black/90 text-white p-1 md:p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                title="View fullscreen"
              >
                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-2 md:mt-4 p-2 md:p-3 bg-black/50 border border-gray-600 rounded">
              <p className="text-xs md:text-sm text-gray-300">
                <span className="font-semibold text-white">Prompt:</span> {generatedImage.prompt}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 select-none">
            <div className="w-8 h-8 md:w-16 md:h-16 mx-auto mb-3 border border-gray-600 rounded flex items-center justify-center bg-black/50">
              <svg className="w-4 h-4 md:w-8 md:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21,15 16,10 5,21" />
              </svg>
            </div>
            <p className="text-xs text-gray-400 font-medium py-1 md:py-2">Ready to generate</p>
          </div>
        )}
      </div>
    </div>
  )
}

