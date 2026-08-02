"use client"

import { useState, createContext, useContext, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { type StudioTab, TAB_ROUTES, getTabFromPathname } from "@/types/studio"

interface StudioContextType {
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

export default function StudioLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [pendingInputImage, setPendingInputImage] = useState<string | null>(null)
  const activeTab = getTabFromPathname(pathname)

  const handleTabChange = (tab: StudioTab) => {
    router.push(TAB_ROUTES[tab])
  }

  return (
    <StudioContext.Provider
      value={{
        pendingInputImage,
        setPendingInputImage,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      <div className="flex h-screen bg-background">
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <main className="flex-1 overflow-auto lg:ml-0 pb-20 lg:pb-0">
          {children}
        </main>
      </div>
    </StudioContext.Provider>
  )
}
