"use client"

import { useState, useRef, useEffect, memo } from "react"

export const LazyImage = memo(({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin: "50px" }
    )
    
    if (imgRef.current) {
      observer.observe(imgRef.current)
    }
    
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={className}>
      {!isInView ? (
        <div className="w-full h-full bg-secondary/20 animate-pulse" />
      ) : (
        <>
          {!isLoaded && <div className="w-full h-full bg-secondary/20 animate-pulse absolute inset-0" />}
          <img
            src={src}
            alt={alt}
            className={`w-full h-full object-cover ${isLoaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
          />
        </>
      )}
    </div>
  )
})

LazyImage.displayName = "LazyImage"

