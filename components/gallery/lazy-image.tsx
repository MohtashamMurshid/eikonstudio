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

// Shimmer placeholder component with image icon
const ShimmerPlaceholder = memo(() => (
  <div className="absolute inset-0 z-10 overflow-hidden bg-secondary/40">
    {/* Shimmer animation */}
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    {/* Centered image icon */}
    <div className="absolute inset-0 flex items-center justify-center">
      <svg 
        className="w-8 h-8 text-foreground/20" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
        strokeWidth={1.5}
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" 
        />
      </svg>
    </div>
  </div>
))
ShimmerPlaceholder.displayName = "ShimmerPlaceholder"

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
        {!isLoaded && <ShimmerPlaceholder />}
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
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
      {!isLoaded && !hasError && <ShimmerPlaceholder />}
      {hasError ? (
        <div className="absolute inset-0 bg-secondary/30 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <svg 
              className="w-6 h-6 text-foreground/30" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" 
              />
            </svg>
            <span className="text-xs text-muted-foreground">Failed to load</span>
          </div>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          sizes={sizes}
          priority={priority}
          className={`object-cover transition-opacity duration-500 ${
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
