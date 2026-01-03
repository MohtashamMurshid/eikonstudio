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
          className="w-full p-2 md:p-3 pr-8 bg-black/50 border border-gray-600 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white rounded select-text"
        />
        {url && (
          <button
            onClick={() => onClear(imageNumber)}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        "w-full h-[60px] sm:h-[80px] lg:w-[140px] lg:h-[120px] lg:flex-shrink-0 border border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-white transition-all bg-black/30 relative",
        preview && "border-white",
      )}
      onDrop={(e) => onDrop(e, imageNumber)}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => document.getElementById(`file${imageNumber}`)?.click()}
    >
      {preview ? (
        <div className="w-full h-full p-1 sm:p-2 relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClear(imageNumber)
            }}
            className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-0.5 sm:p-1 transition-colors"
          >
            <svg className="w-2 h-2 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img src={preview || "/placeholder.svg"} alt={`Image ${imageNumber}`} className="w-full h-full object-contain rounded" />
        </div>
      ) : (
        <div className="text-center text-gray-300 py-1 sm:py-4">
          <svg className="w-3 h-3 sm:w-5 sm:h-5 md:w-6 md:h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-xs">{imageNumber === 1 ? "Upload Image" : "Second Image"}</p>
          {imageNumber === 2 && <p className="text-xs text-gray-400">(optional)</p>}
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

