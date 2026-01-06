"use client"

import { useState, memo } from "react"
import Image from "next/image"

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  fill?: boolean
  sizes?: string
  priority?: boolean
}

export const LazyImage = memo(({ 
  src, 
  alt, 
  className = "",
  fill = true,
  sizes = "(max-width: 768px) 50vw, 25vw",
  priority = false
}: LazyImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Check if src is a base64 data URL (can't be optimized by next/image)
  const isDataUrl = src?.startsWith("data:")

  // For data URLs, use native img tag
  if (isDataUrl) {
    return (
      <div className={`relative ${className}`}>
        {!isLoaded && (
          <div className="absolute inset-0 bg-secondary/20 animate-pulse" />
        )}
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </div>
    )
  }

  // For remote URLs, use next/image for optimization
  return (
    <div className={`relative ${className}`}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-secondary/20 animate-pulse z-10" />
      )}
      {hasError ? (
        <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Failed to load</span>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          sizes={sizes}
          priority={priority}
          className={`object-cover transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  )
})

LazyImage.displayName = "LazyImage"
