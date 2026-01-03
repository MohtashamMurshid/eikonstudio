import { cn } from "@/lib/utils"
import Link from "next/link"

interface LogoProps {
  variant?: "light" | "dark"
  size?: "sm" | "md" | "lg"
  showText?: boolean
  className?: string
}

export function Logo({ 
  variant = "dark", 
  size = "md", 
  showText = true,
  className 
}: LogoProps) {
  const sizes = {
    sm: {
      icon: "size-8",
      iconInner: "size-5",
      text: "text-sm",
    },
    md: {
      icon: "size-10",
      iconInner: "size-6",
      text: "text-base",
    },
    lg: {
      icon: "size-12",
      iconInner: "size-7",
      text: "text-lg",
    },
  }

  const variants = {
    light: {
      iconBg: "bg-white",
      iconColor: "text-black",
      text: "text-white",
    },
    dark: {
      iconBg: "bg-black",
      iconColor: "text-white",
      text: "text-black",
    },
  }

  const currentSize = sizes[size]
  const currentVariant = variants[variant]

  return (
    <Link href="/">
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn(
        "rounded-lg flex items-center justify-center",
        currentSize.icon,
        currentVariant.iconBg
      )}>
        <svg 
          viewBox="0 0 32 32" 
          className={cn(currentSize.iconInner, currentVariant.iconColor)} 
          fill="none"
        >
          {/* Diamond/prism shape representing εἰκών (image) */}
          <path 
            d="M16 3L28 16L16 29L4 16L16 3Z" 
            stroke="currentColor" 
            strokeWidth="2"
            fill="none"
          />
          {/* Inner eye/lens - the seeing element */}
          <circle 
            cx="16" 
            cy="16" 
            r="5" 
            stroke="currentColor" 
            strokeWidth="2"
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
      </div>
      {showText && (
        <span className={cn(
          "font-semibold tracking-tight",
          currentSize.text,
          currentVariant.text
        )}>
          Eikon
        </span>
      )}
    </div>
    </Link>
  )
}

