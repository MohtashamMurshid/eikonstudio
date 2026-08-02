import { LogoIcon } from "@/components/logo-icon"

interface ProgressBarProps {
  progress: number
  label?: string
}

export function ProgressBar({ progress, label = "Generating..." }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))
  
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8 select-none">
      <div className="flex flex-col items-center">
        {/* Logo with circular progress ring */}
        <div className="relative mb-6">
          {/* Progress ring */}
          <svg className="w-28 h-28 transform -rotate-90">
            <circle
              className="text-foreground/10"
              strokeWidth="4"
              stroke="currentColor"
              fill="transparent"
              r="52"
              cx="56"
              cy="56"
            />
            <circle
              className="text-foreground transition-all duration-300 ease-out"
              strokeWidth="4"
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="52"
              cx="56"
              cy="56"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - clampedProgress / 100)}`}
            />
          </svg>
          
          {/* Logo in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-16 bg-foreground rounded-xl flex items-center justify-center">
              <LogoIcon className="size-9 text-background" />
            </div>
          </div>
        </div>

        {/* Percentage */}
        <span className="text-2xl font-semibold text-foreground mb-2">
          {Math.round(clampedProgress)}%
        </span>

        {/* Label */}
        <p className="text-sm text-foreground/60">{label}</p>
      </div>
    </div>
  )
}
