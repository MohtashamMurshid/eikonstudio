"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { useConvexAuth } from "convex/react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { LogoLoader } from "@/components/logo-icon"
import { api } from "@/convex/_generated/api"

// Context for sharing state between studio routes
interface StudioContextType {
  apiKey: string
  setApiKey: (key: string) => void
  pendingInputImage: string | null
  setPendingInputImage: (image: string | null) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

const StudioContext = createContext<StudioContextType | null>(null)

export function useStudioContext() {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error("useStudioContext must be used within StudioLayout")
  }
  return context
}

export default function StudioLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const router = useRouter()
  const pathname = usePathname()
  
  const [apiKey, setApiKey] = useState<string>("")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [pendingInputImage, setPendingInputImage] = useState<string | null>(null)
  
  // Load API key from secure storage
  const storedApiKey = useQuery(api.apiKeys.getApiKey, isAuthenticated ? {} : "skip")

  // Determine active tab from pathname
  const getActiveTab = (): "dashboard" | "studio" | "history" | "gallery" => {
    if (pathname?.includes("/dashboard")) return "dashboard"
    if (pathname?.includes("/history")) return "history"
    if (pathname?.includes("/gallery")) return "gallery"
    return "studio" // default for /studio/create or /studio
  }

  // Sync API key from secure storage when it loads
  useEffect(() => {
    if (storedApiKey?.apiKey) {
      setApiKey(storedApiKey.apiKey)
    }
  }, [storedApiKey?.apiKey])

  // Also check localStorage as fallback (for immediate use before Convex loads)
  useEffect(() => {
    const savedApiKey = localStorage.getItem("gemini-api-key")
    if (savedApiKey && !apiKey) {
      setApiKey(savedApiKey)
    }
  }, [apiKey])

  // Save API key to localStorage whenever it changes (for sync)
  const handleApiKeyChange = (key: string) => {
    setApiKey(key)
    if (key) {
      localStorage.setItem("gemini-api-key", key)
    } else {
      localStorage.removeItem("gemini-api-key")
    }
  }

  // Handle tab change via navigation
  const handleTabChange = (tab: "dashboard" | "studio" | "history" | "gallery" | "settings") => {
    switch (tab) {
      case "dashboard":
        router.push("/studio/dashboard")
        break
      case "studio":
        router.push("/studio/create")
        break
      case "history":
        router.push("/studio/history")
        break
      case "gallery":
        router.push("/studio/gallery")
        break
      case "settings":
        router.push("/studio/settings")
        break
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
      <div className="h-screen bg-[#f5f5f5] flex items-center justify-center select-none">
        <LogoLoader size="lg" text="Initializing" />
      </div>
    )
  }

  // Show nothing while redirecting (if not authenticated)
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-[#f5f5f5] flex items-center justify-center select-none">
        <LogoLoader size="lg" text="Redirecting" />
      </div>
    )
  }

  // Authenticated - show layout with sidebar
  return (
    <StudioContext.Provider
      value={{
        apiKey,
        setApiKey: handleApiKeyChange,
        pendingInputImage,
        setPendingInputImage,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      <div className="flex h-screen bg-[#f5f5f5]">
        {/* Sidebar */}
        <Sidebar
          activeTab={getActiveTab()}
          onTabChange={handleTabChange}
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-auto lg:ml-0 pb-20 lg:pb-0">
          {children}
        </main>
      </div>
    </StudioContext.Provider>
  )
}

