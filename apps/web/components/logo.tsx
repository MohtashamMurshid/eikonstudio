import { cn } from "@/lib/utils"
import Link from "next/link"
import { LogoIcon } from "./logo-icon"

// ============================================================================
// Types
// ============================================================================

type LogoVariant = "default" | "icon" | "wordmark" | "stacked"
type LogoColorScheme = "dark" | "light" | "auto"
type LogoSize = "xs" | "sm" | "md" | "lg" | "xl"

interface LogoProps {
  /** Logo variant: default (horizontal), icon-only, wordmark-only, or stacked */
  variant?: LogoVariant
  /** Color scheme: dark (for light bg), light (for dark bg), or auto */
  colorScheme?: LogoColorScheme
  /** Size preset */
  size?: LogoSize
  /** Optional tagline below the logo */
  tagline?: string
  /** Wrap logo in a link */
  asLink?: boolean
  /** Link destination (requires asLink=true) */
  href?: string
  /** Additional CSS classes */
  className?: string
}

// ============================================================================
// Size Configurations
// ============================================================================

const sizeConfig = {
  xs: {
    icon: "size-6",
    iconInner: "size-3.5",
    text: "text-xs",
    tagline: "text-[10px]",
    gap: "gap-1.5",
    stackedGap: "gap-1",
    iconBg: "rounded-md",
  },
  sm: {
    icon: "size-8",
    iconInner: "size-5",
    text: "text-sm",
    tagline: "text-xs",
    gap: "gap-2",
    stackedGap: "gap-1.5",
    iconBg: "rounded-lg",
  },
  md: {
    icon: "size-10",
    iconInner: "size-6",
    text: "text-base",
    tagline: "text-xs",
    gap: "gap-2.5",
    stackedGap: "gap-2",
    iconBg: "rounded-lg",
  },
  lg: {
    icon: "size-12",
    iconInner: "size-7",
    text: "text-lg",
    tagline: "text-sm",
    gap: "gap-3",
    stackedGap: "gap-2.5",
    iconBg: "rounded-xl",
  },
  xl: {
    icon: "size-16",
    iconInner: "size-9",
    text: "text-xl",
    tagline: "text-base",
    gap: "gap-4",
    stackedGap: "gap-3",
    iconBg: "rounded-xl",
  },
}

// ============================================================================
// Color Scheme Configurations
// ============================================================================

const colorSchemeConfig = {
  dark: {
    iconBg: "bg-foreground",
    iconColor: "text-background",
    text: "text-foreground",
    tagline: "text-foreground/60",
  },
  light: {
    iconBg: "bg-white",
    iconColor: "text-black",
    text: "text-white",
    tagline: "text-white/60",
  },
  auto: {
    iconBg: "bg-foreground dark:bg-white",
    iconColor: "text-background dark:text-black",
    text: "text-foreground dark:text-white",
    tagline: "text-foreground/60 dark:text-white/60",
  },
}

// ============================================================================
// Logo Component
// ============================================================================

export function Logo({
  variant = "default",
  colorScheme = "dark",
  size = "md",
  tagline,
  asLink = false,
  href = "/",
  className,
}: LogoProps) {
  const sizes = sizeConfig[size]
  const colors = colorSchemeConfig[colorScheme]

  // Icon with background
  const IconWithBg = (
    <div
      className={cn(
        "flex items-center justify-center shrink-0",
        sizes.icon,
        sizes.iconBg,
        colors.iconBg
      )}
    >
      <LogoIcon className={cn(sizes.iconInner, colors.iconColor)} />
    </div>
  )

  // Wordmark text
  const Wordmark = (
    <span
      className={cn(
        "font-semibold tracking-tight",
        sizes.text,
        colors.text
      )}
    >
      Eikon
    </span>
  )

  // Tagline text
  const TaglineText = tagline && (
    <span
      className={cn(
        "block",
        sizes.tagline,
        colors.tagline
      )}
    >
      {tagline}
    </span>
  )

  // Render based on variant
  let content: React.ReactNode

  switch (variant) {
    case "icon":
      content = (
        <div className={cn("flex flex-col", className)}>
          {IconWithBg}
          {TaglineText}
        </div>
      )
      break

    case "wordmark":
      content = (
        <div className={cn("flex flex-col", className)}>
          {Wordmark}
          {TaglineText}
        </div>
      )
      break

    case "stacked":
      content = (
        <div className={cn("flex flex-col items-center", sizes.stackedGap, className)}>
          {IconWithBg}
          <div className="flex flex-col items-center">
            {Wordmark}
            {TaglineText}
          </div>
        </div>
      )
      break

    case "default":
    default:
      content = (
        <div className={cn("flex flex-col", className)}>
          <div className={cn("flex items-center", sizes.gap)}>
            {IconWithBg}
            {Wordmark}
          </div>
          {TaglineText}
        </div>
      )
      break
  }

  // Wrap in link if requested
  if (asLink) {
    return (
      <Link href={href} className="inline-block">
        {content}
      </Link>
    )
  }

  return content
}

// ============================================================================
// Convenience Exports
// ============================================================================

/** Logo with just the icon (no text) */
export function LogoIconOnly(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="icon" />
}

/** Logo with just the wordmark (no icon) */
export function LogoWordmark(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="wordmark" />
}

/** Stacked logo (icon above text) */
export function LogoStacked(props: Omit<LogoProps, "variant">) {
  return <Logo {...props} variant="stacked" />
}
