interface ProgressBarProps {
  progress: number
  label?: string
}

export function ProgressBar({ progress, label = "Generating..." }: ProgressBarProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8 select-none">
      <div className="w-full max-w-md">
        {/* Progress ring */}
        <div className="flex justify-center mb-6">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                className="text-gray-200"
                strokeWidth="6"
                stroke="currentColor"
                fill="transparent"
                r="34"
                cx="40"
                cy="40"
              />
              <circle
                className="text-emerald-500 transition-all duration-300 ease-out"
                strokeWidth="6"
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="34"
                cx="40"
                cy="40"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-semibold text-foreground">{Math.round(progress)}%</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div
            className="absolute inset-0 h-full bg-emerald-500 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-foreground/70 animate-pulse">{label}</p>
        </div>
      </div>
    </div>
  )
}
