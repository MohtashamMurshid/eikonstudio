interface DragOverlayProps {
  isDragOver: boolean
}

export function DragOverlay({ isDragOver }: DragOverlayProps) {
  if (!isDragOver) return null

  return (
    <div className="fixed inset-0 z-50 bg-emerald-500/10 backdrop-blur-sm flex items-center justify-center select-none pointer-events-none">
      <div className="bg-white border-2 border-dashed border-emerald-500 rounded-2xl p-12 text-center shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <p className="text-lg font-semibold text-foreground">Drop your image here</p>
        <p className="text-sm text-foreground/50 mt-1">Release to upload</p>
      </div>
    </div>
  )
}
