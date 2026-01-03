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
    <div className="space-y-6 select-none">
      <div className="flex items-center justify-between">
        <h3 className="text-sm md:text-base font-semibold flex items-center gap-2 text-foreground">
          <svg className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21,15 16,10 5,21" />
          </svg>
          Result
        </h3>
        {generatedImage && (
          <div className="flex gap-2">
            <Button
              onClick={onUseAsInput}
              variant="outline"
              size="sm"
              className="text-xs h-8 px-3 bg-white border-border text-foreground hover:bg-gray-50 flex items-center gap-1.5"
              title="Use as Input"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="text-xs h-8 px-3 bg-white border-border text-foreground hover:bg-gray-50 flex items-center gap-1.5"
              title="Copy"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v9a2 2 0 01-2 2H5z" />
              </svg>
              <span className="hidden sm:inline">Copy</span>
            </Button>
            <Button
              onClick={onDownload}
              variant="outline"
              size="sm"
              className="text-xs h-8 px-3 bg-white border-border text-foreground hover:bg-gray-50 flex items-center gap-1.5"
              title="Download"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      <div className="flex items-center justify-center min-h-[280px] md:min-h-[360px] bg-white border border-border rounded-xl">
        {isLoading ? (
          <ProgressBar progress={progress} />
        ) : isConvertingHeic ? (
          <ProgressBar progress={heicProgress} label="Converting HEIC image..." />
        ) : generatedImage ? (
          <div className="w-full h-full flex flex-col select-none p-4">
            <div className="flex-1 flex items-center justify-center max-h-[200px] md:max-h-[280px] relative group">
              <img
                src={generatedImage.url || "/placeholder.svg"}
                alt="Generated"
                className={`max-w-full max-h-full object-contain rounded-lg shadow-sm transition-opacity duration-500 ${
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
                className="absolute top-2 right-2 bg-foreground/80 hover:bg-foreground text-background p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                title="View fullscreen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-4 p-3 bg-gray-50 border border-border rounded-lg">
              <p className="text-sm text-foreground/70">
                <span className="font-semibold text-foreground">Prompt:</span> {generatedImage.prompt}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 select-none">
            <div className="w-16 h-16 mx-auto mb-4 border-2 border-dashed border-border rounded-xl flex items-center justify-center bg-gray-50">
              <svg className="w-8 h-8 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21,15 16,10 5,21" />
              </svg>
            </div>
            <p className="text-sm text-foreground/50 font-medium">Ready to generate</p>
            <p className="text-xs text-foreground/40 mt-1">Enter a prompt and click Generate</p>
          </div>
        )}
      </div>
    </div>
  )
}
