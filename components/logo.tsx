import { cn } from "@/lib/utils"

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
      iconInner: "size-4",
      text: "text-sm",
    },
    md: {
      icon: "size-10",
      iconInner: "size-5",
      text: "text-base",
    },
    lg: {
      icon: "size-12",
      iconInner: "size-6",
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
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "rounded-xl flex items-center justify-center",
        currentSize.icon,
        currentVariant.iconBg
      )}>
        <svg 
          viewBox="0 0 24 24" 
          className={cn(currentSize.iconInner, currentVariant.iconColor)} 
          fill="currentColor"
        >
          <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/>
        </svg>
      </div>
      {showText && (
        <span className={cn(
          "font-semibold tracking-tight",
          currentSize.text,
          currentVariant.text
        )}>
          PixelForge
        </span>
      )}
    </div>
  )
}

