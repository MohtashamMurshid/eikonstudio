import { cn } from "@/lib/utils"

interface LogoIconProps {
  className?: string
  /** Stroke width for the icon paths */
  strokeWidth?: number
}

/**
 * Standalone Eikon logo icon SVG component.
 * Use this for places where you need just the icon without text.
 * 
 * The icon represents εἰκών (eikon) - Greek for "image":
 * - Outer diamond/prism shape
 * - Inner circle (eye/lens)
 * - Center dot (focus point)
 */
export function LogoIcon({ className, strokeWidth = 2.5 }: LogoIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Diamond/prism shape representing εἰκών (image) */}
      <path
        d="M16 3L28 16L16 29L4 16L16 3Z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Inner eye/lens - the seeing element */}
      <circle
        cx="16"
        cy="16"
        r="5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Center dot - focus point */}
      <circle
        cx="16"
        cy="16"
        r="2"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * Simplified logo icon for very small sizes (favicons, etc.)
 * Uses slightly different proportions for better legibility at small sizes.
 */
export function LogoIconSimple({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M16 4L27 16L16 28L5 16L16 4Z"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
      <circle
        cx="16"
        cy="16"
        r="4"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
      <circle
        cx="16"
        cy="16"
        r="1.5"
        fill="currentColor"
      />
    </svg>
  )
}

// ============================================================================
// Loading States
// ============================================================================

type LogoLoaderSize = "sm" | "md" | "lg"

interface LogoLoaderProps {
  /** Size of the loader */
  size?: LogoLoaderSize
  /** Optional loading text */
  text?: string
  /** Additional CSS classes for the container */
  className?: string
}

const loaderSizes = {
  sm: {
    container: "size-10",
    icon: "size-6",
    ring: "size-10",
    rounded: "rounded-lg",
  },
  md: {
    container: "size-14",
    icon: "size-8",
    ring: "size-14",
    rounded: "rounded-xl",
  },
  lg: {
    container: "size-20",
    icon: "size-11",
    ring: "size-20",
    rounded: "rounded-2xl",
  },
}

/**
 * Animated logo loader for loading states.
 * Features a pulsing logo with optional loading text.
 */
export function LogoLoader({ size = "md", text, className }: LogoLoaderProps) {
  const sizes = loaderSizes[size]

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Animated logo */}
      <div className="relative">
        {/* Pulse ring */}
        <div
          className={cn(
            "absolute inset-0 bg-foreground/10 animate-ping",
            sizes.ring,
            sizes.rounded
          )}
        />

        {/* Logo container with spin animation on the icon */}
        <div
          className={cn(
            "relative bg-foreground flex items-center justify-center",
            sizes.container,
            sizes.rounded
          )}
        >
          <LogoIcon className={cn(sizes.icon, "text-background animate-pulse")} />
        </div>
      </div>

      {/* Loading text */}
      {text !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/60 font-medium">{text || "Loading"}</span>
          <span className="flex gap-1">
            <span className="size-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="size-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="size-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Full-page loading screen with centered logo loader.
 * Use this for page-level loading states.
 */
export function LogoLoaderFullPage({ text = "Loading" }: { text?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LogoLoader size="lg" text={text} />
    </div>
  )
}

// ============================================================================
// Progress Bar Loader
// ============================================================================

interface LogoLoaderWithProgressProps {
  /** Progress value from 0 to 100 */
  progress: number
  /** Optional loading text */
  text?: string
  /** Size of the loader */
  size?: LogoLoaderSize
  /** Additional CSS classes */
  className?: string
}

/**
 * Logo loader with a progress bar.
 * Use this for determinate loading states where you know the progress.
 */
export function LogoLoaderWithProgress({
  progress,
  text,
  size = "md",
  className,
}: LogoLoaderWithProgressProps) {
  const sizes = loaderSizes[size]
  const clampedProgress = Math.min(100, Math.max(0, progress))

  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      {/* Logo */}
      <div
        className={cn(
          "relative bg-foreground flex items-center justify-center",
          sizes.container,
          sizes.rounded
        )}
      >
        <LogoIcon className={cn(sizes.icon, "text-background")} />
      </div>

      {/* Progress bar */}
      <div className="w-48 flex flex-col items-center gap-2">
        <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
        
        {/* Text and percentage */}
        <div className="flex items-center justify-between w-full">
          {text && (
            <span className="text-xs text-foreground/60">{text}</span>
          )}
          <span className="text-xs text-foreground/60 font-mono ml-auto">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Full-page loading screen with progress bar.
 */
export function LogoLoaderFullPageWithProgress({
  progress,
  text = "Loading",
}: {
  progress: number
  text?: string
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LogoLoaderWithProgress size="lg" progress={progress} text={text} />
    </div>
  )
}

// ============================================================================
// Skeleton Loader
// ============================================================================

/**
 * Minimal logo skeleton for inline loading states.
 */
export function LogoSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 animate-pulse", className)}>
      <div className="size-10 bg-foreground/10 rounded-lg" />
      <div className="h-4 w-16 bg-foreground/10 rounded" />
    </div>
  )
}

