import type { ImageSlot } from "../hooks/use-image-upload"

interface ImagePreviewGridProps {
  image1Preview: string | null
  image2Preview: string | null
  image3Preview: string | null
  image4Preview: string | null
  removingImages: { 1?: boolean; 2?: boolean; 3?: boolean; 4?: boolean }
  onReplace: (slot: ImageSlot) => void
  onRemove: (slot: ImageSlot) => void
}

export function ImagePreviewGrid({
  image1Preview,
  image2Preview,
  image3Preview,
  image4Preview,
  removingImages,
  onReplace,
  onRemove,
}: ImagePreviewGridProps) {
  const hasAnyPreview = image1Preview || image2Preview || image3Preview || image4Preview

  return (
    <div
      className="grid"
      style={{
        gridTemplateRows: hasAnyPreview ? "1fr" : "0fr",
      }}
    >
      <div className="overflow-hidden">
        <div className="p-3 sm:p-4 pb-0">
          <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
            {([
              { slot: 1 as ImageSlot, preview: image1Preview },
              { slot: 2 as ImageSlot, preview: image2Preview },
              { slot: 3 as ImageSlot, preview: image3Preview },
              { slot: 4 as ImageSlot, preview: image4Preview },
            ]).map(({ slot, preview }) =>
              preview ? (
                <div
                  key={slot}
                  className={`relative group transition-[transform,opacity] duration-180 ease-[var(--ease-ui-out)] motion-reduce:transition-opacity ${
                    removingImages[slot]
                      ? "opacity-0 scale-90"
                      : "opacity-100 scale-100"
                  }`}
                >
                  <img
                    src={preview}
                    alt={`Input ${slot}`}
                    className="w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] rounded-lg sm:rounded-xl object-cover border border-border/50"
                  />
                  {/* Action buttons - always visible on mobile */}
                  <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 flex items-center gap-0.5">
                    <button
                      onClick={() => onReplace(slot)}
                      className="ui-pressable w-5 h-5 sm:w-6 sm:h-6 bg-background/90 backdrop-blur-sm text-foreground rounded-full flex items-center justify-center opacity-100 [@media(hover:hover)_and_(pointer:fine)]:sm:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:sm:group-hover:opacity-100 shadow-sm border border-border/50"
                      title="Replace image"
                    >
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onRemove(slot)}
                      className="ui-pressable w-5 h-5 sm:w-6 sm:h-6 bg-background/90 backdrop-blur-sm text-foreground rounded-full flex items-center justify-center opacity-100 [@media(hover:hover)_and_(pointer:fine)]:sm:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:sm:group-hover:opacity-100 shadow-sm border border-border/50"
                      title="Remove image"
                    >
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* Slot number indicator */}
                  <div className="absolute bottom-1 left-1 w-4 h-4 bg-foreground/80 text-background rounded-full flex items-center justify-center text-[10px] font-medium">
                    {slot}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
