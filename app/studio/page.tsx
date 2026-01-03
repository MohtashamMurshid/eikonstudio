"use client";

import { ImageCombiner } from "@/components/image-combiner/index"
import { Header } from "@/components/header"
import { useConvexAuth } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function StudioPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const router = useRouter()
  const [apiKey, setApiKey] = useState<string>("")

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem("pixelforge_api_key")
    if (savedApiKey) {
      setApiKey(savedApiKey)
    }
  }, [])

  // Save API key to localStorage whenever it changes
  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    if (key) {
      localStorage.setItem("pixelforge_api_key", key)
    } else {
      localStorage.removeItem("pixelforge_api_key")
    }
  }

  useEffect(() => {
    // Only redirect after loading is complete and user is not authenticated
    if (!isLoading && !isAuthenticated) {
      router.push("/auth")
    }
  }, [isLoading, isAuthenticated, router])

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center select-none">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-16 h-16 bg-foreground rounded-xl flex items-center justify-center">
            <svg
              className="w-9 h-9 text-background"
              viewBox="0 0 32 32"
              fill="none"
            >
              <path 
                d="M16 3L28 16L16 29L4 16L16 3Z" 
                stroke="currentColor" 
                strokeWidth="2"
                fill="none"
              />
              <circle 
                cx="16" 
                cy="16" 
                r="5" 
                stroke="currentColor" 
                strokeWidth="2"
                fill="none"
              />
              <circle 
                cx="16" 
                cy="16" 
                r="2" 
                fill="currentColor"
              />
            </svg>
          </div>
          <span className="text-2xl font-bold text-foreground tracking-tight">Eikon</span>
        </div>
        <p className="mt-8 text-muted-foreground text-sm animate-pulse">Initializing...</p>
      </div>
    )
  }

  // Show nothing while redirecting (if not authenticated)
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center select-none">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-16 h-16 bg-foreground rounded-xl flex items-center justify-center">
            <svg
              className="w-9 h-9 text-background"
              viewBox="0 0 32 32"
              fill="none"
            >
              <path 
                d="M16 3L28 16L16 29L4 16L16 3Z" 
                stroke="currentColor" 
                strokeWidth="2"
                fill="none"
              />
              <circle 
                cx="16" 
                cy="16" 
                r="5" 
                stroke="currentColor" 
                strokeWidth="2"
                fill="none"
              />
              <circle 
                cx="16" 
                cy="16" 
                r="2" 
                fill="currentColor"
              />
            </svg>
          </div>
          <span className="text-2xl font-bold text-foreground tracking-tight">Eikon</span>
        </div>
        <p className="mt-8 text-muted-foreground text-sm animate-pulse">Redirecting...</p>
      </div>
    )
  }

  // Authenticated - show main content
  return (
    <main className="h-screen bg-background overflow-hidden relative">
      <Header apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
      <div className="pt-14 h-full">
        <ImageCombiner apiKey={apiKey} />
      </div>
    </main>
  )
}

