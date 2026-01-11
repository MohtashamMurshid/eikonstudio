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
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-3 select-none">
          <label className="text-sm font-medium text-foreground/70">Reference Images</label>
          <div className="inline-flex bg-secondary border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => onUseUrlsChange(false)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                !useUrls ? "bg-card text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground",
              )}
            >
              Files
            </button>
            <button
              onClick={() => onUseUrlsChange(true)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-all",
                useUrls ? "bg-card text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground",
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
            <div className="grid grid-cols-2 gap-3 lg:flex lg:justify-start lg:gap-4">
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
