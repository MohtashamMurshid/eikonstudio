"use client";

import { ImageCombiner } from "@/components/image-combiner/index"
import { Header } from "@/components/header"
import { useConvexAuth } from "convex/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function Home() {
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
      <div className="h-screen bg-black flex items-center justify-center select-none">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Show nothing while redirecting (if not authenticated)
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-black flex items-center justify-center select-none">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Redirecting...</p>
        </div>
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
