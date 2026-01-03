interface DragOverlayProps {
  isDragOver: boolean
}

export function DragOverlay({ isDragOver }: DragOverlayProps) {
  if (!isDragOver) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center select-none">
      <div className="bg-white/10 border-2 border-dashed border-white/50 rounded-xl p-8 md:p-12 text-center mx-4">
        <svg className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Drop Images Here</h3>
        <p className="text-gray-300 text-sm md:text-base">Release to upload your images</p>
      </div>
    </div>
  )
}

