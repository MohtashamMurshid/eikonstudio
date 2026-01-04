"use client"

import { useState, useEffect } from "react"
import { useConvexAuth } from "convex/react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { authClient } from "@/lib/auth-client"

import { Sidebar } from "@/components/dashboard/sidebar"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { GenerationChart } from "@/components/dashboard/generation-chart"
import { ImageCombiner } from "@/components/image-combiner/index"
import { GenerationHistory } from "@/components/dashboard/generation-history"

export default function StudioPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const router = useRouter()
  const [apiKey, setApiKey] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"dashboard" | "studio" | "history">("studio")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [pendingInputImage, setPendingInputImage] = useState<string | null>(null)
  
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)
  
  const displayName = user?.name || session?.user?.name || "User"

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

  // Handle using a history image as input
  const handleUseAsInput = (imageData: string) => {
    setPendingInputImage(imageData)
    setActiveTab("studio")
  }

  // Clear pending input after it's been loaded
  const handleInputImageLoaded = () => {
    setPendingInputImage(null)
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
      <div className="h-screen bg-[#f5f5f5] flex flex-col items-center justify-center select-none">
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
        <p className="mt-8 text-foreground/50 text-sm animate-pulse">Initializing...</p>
      </div>
    )
  }

  // Show nothing while redirecting (if not authenticated)
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-[#f5f5f5] flex flex-col items-center justify-center select-none">
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
        <p className="mt-8 text-foreground/50 text-sm animate-pulse">Redirecting...</p>
      </div>
    )
  }

  // Authenticated - show dashboard
  return (
    <div className="flex h-screen bg-[#f5f5f5]">
      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main Content */}
      <main className="flex-1 overflow-auto lg:ml-0">
        {/* Tab Content */}
        {activeTab === "dashboard" ? (
          <div className="p-6 space-y-6">
            {/* Stats Cards with Welcome */}
            <StatsCards userName={displayName} />

            {/* Generation Chart */}
            <GenerationChart />
          </div>
        ) : activeTab === "history" ? (
          <div className="p-6 min-h-screen">
            {/* History Tab */}
            <div className="bg-white rounded-2xl border border-border p-6 md:p-8 min-h-[calc(100vh-3rem)]">
              <GenerationHistory onUseAsInput={handleUseAsInput} />
            </div>
          </div>
        ) : (
          <div className="p-6 min-h-screen">
            {/* Studio Tab */}
            <div className="bg-white rounded-2xl border border-border p-6 md:p-8 min-h-[calc(100vh-3rem)]">
              <ImageCombiner 
                apiKey={apiKey} 
                pendingInputImage={pendingInputImage}
                onInputImageLoaded={handleInputImageLoaded}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
