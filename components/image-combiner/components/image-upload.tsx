import { cn } from "@/lib/utils"

interface ImageUploadProps {
  imageNumber: 1 | 2
  preview: string
  url: string
  useUrls: boolean
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, imageNumber: 1 | 2) => void
  onDrop: (e: React.DragEvent, imageNumber: 1 | 2) => void
  onUrlChange: (url: string, imageNumber: 1 | 2) => void
  onClear: (imageNumber: 1 | 2) => void
}

export function ImageUpload({
  imageNumber,
  preview,
  url,
  useUrls,
  onFileSelect,
  onDrop,
  onUrlChange,
  onClear,
}: ImageUploadProps) {
  if (useUrls) {
    return (
      <div className="relative">
        <input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value, imageNumber)}
          placeholder={imageNumber === 1 ? "First image URL" : "Second image URL (optional)"}
          className="w-full p-3 pr-8 bg-white border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-foreground/40 select-text transition-colors"
        />
        {url && (
          <button
            onClick={() => onClear(imageNumber)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "w-full h-[80px] sm:h-[100px] lg:w-[160px] lg:h-[130px] lg:flex-shrink-0 border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all bg-white relative group",
        preview && "border-solid border-emerald-500 bg-emerald-50/30",
      )}
      onDrop={(e) => onDrop(e, imageNumber)}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => document.getElementById(`file${imageNumber}`)?.click()}
    >
      {preview ? (
        <div className="w-full h-full p-2 relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClear(imageNumber)
            }}
            className="absolute top-1 right-1 z-10 bg-foreground/80 hover:bg-foreground text-background rounded-full p-1 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img src={preview || "/placeholder.svg"} alt={`Image ${imageNumber}`} className="w-full h-full object-contain rounded-lg" />
        </div>
      ) : (
        <div className="text-center text-foreground/50 py-2 sm:py-4">
          <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-foreground/30 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-xs font-medium">{imageNumber === 1 ? "Upload Image" : "Second Image"}</p>
          {imageNumber === 2 && <p className="text-xs text-foreground/40">(optional)</p>}
        </div>
      )}
      <input
        id={`file${imageNumber}`}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => onFileSelect(e, imageNumber)}
      />
    </div>
  )
}
