interface ProgressBarProps {
  progress: number
  label?: string
}

export function ProgressBar({ progress, label = "Running..." }: ProgressBarProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-4 select-none">
      <div className="w-full max-w-md">
        <div className="relative h-4 md:h-8 bg-black/50 border border-gray-600 rounded overflow-hidden mb-4" style={{ zIndex: 30 }}>
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(90deg, transparent 0%, transparent 49%, #333 49%, #333 51%, transparent 51%),
                linear-gradient(0deg, transparent 0%, transparent 49%, #333 49%, #333 51%, transparent 51%)
              `,
              backgroundSize: "8px 8px",
            }}
          />

          <div
            className="absolute top-0 left-0 h-full transition-all duration-100 ease-out"
            style={{
              width: `${progress}%`,
              backgroundImage: `
                repeating-linear-gradient(
                  90deg,
                  #614B00 0px,
                  #614B00 6px,
                  #735B00 6px,
                  #735B00 8px
                ),
                repeating-linear-gradient(
                  0deg,
                  #614B00 0px,
                  #614B00 6px,
                  #735B00 6px,
                  #735B00 8px
                )
              `,
              backgroundSize: "8px 8px",
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs md:text-sm font-mono text-white/80" style={{ zIndex: 40 }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs md:text-sm font-medium text-white animate-pulse">{label}</p>
        </div>
      </div>
    </div>
  )
}

