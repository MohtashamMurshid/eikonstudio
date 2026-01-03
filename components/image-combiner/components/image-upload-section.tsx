import { cn } from "@/lib/utils"
import { ImageUpload } from "./image-upload"

interface ImageUploadSectionProps {
  useUrls: boolean
  image1Preview: string
  image1Url: string
  image2Preview: string
  image2Url: string
  onUseUrlsChange: (useUrls: boolean) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, imageNumber: 1 | 2) => void
  onDrop: (e: React.DragEvent, imageNumber: 1 | 2) => void
  onUrlChange: (url: string, imageNumber: 1 | 2) => void
  onClear: (imageNumber: 1 | 2) => void
}

export function ImageUploadSection({
  useUrls,
  image1Preview,
  image1Url,
  image2Preview,
  image2Url,
  onUseUrlsChange,
  onFileSelect,
  onDrop,
  onUrlChange,
  onClear,
}: ImageUploadSectionProps) {
  return (
    <div className="space-y-3 md:space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3 md:mb-6 select-none">
          <label className="text-xs md:text-sm font-medium text-gray-300">Images</label>
          <div className="inline-flex bg-black/50 border border-gray-600 rounded">
            <button
              onClick={() => onUseUrlsChange(false)}
              className={cn(
                "px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-medium transition-all rounded-l",
                !useUrls ? "bg-white text-black" : "text-gray-300 hover:text-white",
              )}
            >
              Files
            </button>
            <button
              onClick={() => onUseUrlsChange(true)}
              className={cn(
                "px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-medium transition-all rounded-r",
                useUrls ? "bg-white text-black" : "text-gray-300 hover:text-white",
              )}
            >
              URLs
            </button>
          </div>
        </div>

        {useUrls ? (
          <div className="space-y-2" style={{ minHeight: "80px" }}>
            <ImageUpload
              imageNumber={1}
              preview={image1Preview}
              url={image1Url}
              useUrls={useUrls}
              onFileSelect={onFileSelect}
              onDrop={onDrop}
              onUrlChange={onUrlChange}
              onClear={onClear}
            />
            <ImageUpload
              imageNumber={2}
              preview={image2Preview}
              url={image2Url}
              useUrls={useUrls}
              onFileSelect={onFileSelect}
              onDrop={onDrop}
              onUrlChange={onUrlChange}
              onClear={onClear}
            />
          </div>
        ) : (
          <div className="space-y-2 select-none" style={{ minHeight: "80px" }}>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:flex lg:justify-start lg:gap-4">
              <ImageUpload
                imageNumber={1}
                preview={image1Preview}
                url={image1Url}
                useUrls={useUrls}
                onFileSelect={onFileSelect}
                onDrop={onDrop}
                onUrlChange={onUrlChange}
                onClear={onClear}
              />
              <ImageUpload
                imageNumber={2}
                preview={image2Preview}
                url={image2Url}
                useUrls={useUrls}
                onFileSelect={onFileSelect}
                onDrop={onDrop}
                onUrlChange={onUrlChange}
                onClear={onClear}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

