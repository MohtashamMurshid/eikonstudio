"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { useConvexAuth } from "convex/react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { LogoLoader } from "@/components/logo-icon"
import { api } from "@/convex/_generated/api"
import { type StudioTab, TAB_ROUTES, getTabFromPathname } from "@/types/studio"

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
  const activeTab = getTabFromPathname(pathname)

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
  const handleTabChange = (tab: StudioTab) => {
    router.push(TAB_ROUTES[tab])
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
      <div className="h-screen bg-background flex items-center justify-center select-none">
        <LogoLoader size="lg" text="Initializing" />
      </div>
    )
  }

  // Show nothing while redirecting (if not authenticated)
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-background flex items-center justify-center select-none">
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
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
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

