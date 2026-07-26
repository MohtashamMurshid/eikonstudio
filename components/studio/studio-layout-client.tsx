"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { useRouter, usePathname } from "next/navigation"
import { Sidebar } from "@/components/dashboard/sidebar"
import { api } from "@/convex/_generated/api"
import { type StudioTab, TAB_ROUTES, getTabFromPathname } from "@/types/studio"

type ProviderApiKeys = {
  gemini: string
  openai: string
}

interface StudioContextType {
  apiKey: string
  setApiKey: (key: string) => void
  providerApiKeys: ProviderApiKeys
  setProviderApiKey: (provider: keyof ProviderApiKeys, key: string) => void
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

  const [providerApiKeys, setProviderApiKeys] = useState<ProviderApiKeys>({
    gemini: "",
    openai: "",
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [pendingInputImage, setPendingInputImage] = useState<string | null>(null)

  const storedApiKeys = useQuery(api.apiKeys.getMyProviderApiKeys, {})
  const activeTab = getTabFromPathname(pathname)

  useEffect(() => {
    if (!storedApiKeys) return

    setProviderApiKeys((current) => ({
      gemini: storedApiKeys.gemini?.apiKey || current.gemini,
      openai: storedApiKeys.openai?.apiKey || current.openai,
    }))
  }, [storedApiKeys])

  useEffect(() => {
    setProviderApiKeys((current) => {
      const nextKeys = { ...current }
      const savedGeminiKey = localStorage.getItem("gemini-api-key")
      const savedOpenAiKey = localStorage.getItem("openai-api-key")

      if (savedGeminiKey && !nextKeys.gemini) {
        nextKeys.gemini = savedGeminiKey
      }
      if (savedOpenAiKey && !nextKeys.openai) {
        nextKeys.openai = savedOpenAiKey
      }

      return nextKeys
    })
  }, [])

  const handleProviderApiKeyChange = (provider: keyof ProviderApiKeys, key: string) => {
    setProviderApiKeys((current) => ({
      ...current,
      [provider]: key,
    }))

    const storageKey = provider === "gemini" ? "gemini-api-key" : "openai-api-key"
    if (key) {
      localStorage.setItem(storageKey, key)
    } else {
      localStorage.removeItem(storageKey)
    }
  }

  const handleTabChange = (tab: StudioTab) => {
    router.push(TAB_ROUTES[tab])
  }

  return (
    <StudioContext.Provider
      value={{
        apiKey: providerApiKeys.gemini,
        setApiKey: (key) => handleProviderApiKeyChange("gemini", key),
        providerApiKeys,
        setProviderApiKey: handleProviderApiKeyChange,
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
