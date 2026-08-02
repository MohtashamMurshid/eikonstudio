"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"

interface DashboardHeaderProps {
  activeTab: "dashboard" | "studio"
  apiKey: string
  onApiKeyChange: (key: string) => void
}

export function DashboardHeader({ activeTab, apiKey, onApiKeyChange }: DashboardHeaderProps) {
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)
  const router = useRouter()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showApiKeySection, setShowApiKeySection] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
        setShowApiKeySection(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/auth")
        },
      },
    })
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const displayName = user?.name || session?.user?.name || "User"
  const displayEmail = user?.email || session?.user?.email || ""
  const displayImage = user?.image || session?.user?.image

  const breadcrumbLabel = activeTab === "dashboard" ? "Overview" : "Studio"

  return (
    <header className="sticky top-0 z-30 bg-background border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-foreground font-medium">Dashboard</span>
          <svg className="w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-foreground/60">{breadcrumbLabel}</span>
        </div>

        {/* Right side: Search + User */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden sm:block">
            <svg 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* User Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setIsDropdownOpen(!isDropdownOpen)
                if (isDropdownOpen) setShowApiKeySection(false)
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-medium text-white">
                  {getInitials(displayName)}
                </div>
              )}
              
              <span className="hidden md:block text-sm text-foreground/70 max-w-[120px] truncate">
                {displayName}
              </span>
              
              <svg
                className={`w-4 h-4 text-foreground/40 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-border bg-secondary">
                  <div className="flex items-center gap-3">
                    {displayImage ? (
                      <img
                        src={displayImage}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-medium text-white">
                        {getInitials(displayName)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                      <p className="text-xs text-foreground/50 truncate">{displayEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  {/* API Key Section */}
                  <button
                    onClick={() => setShowApiKeySection(!showApiKeySection)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4 text-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <span>API Key</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {apiKey ? (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">Set</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Not set</span>
                      )}
                      <svg
                        className={`w-4 h-4 text-foreground/40 transition-transform ${showApiKeySection ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* API Key Expanded Section */}
                  {showApiKeySection && (
                    <div className="px-4 py-3 bg-secondary border-y border-border animate-in slide-in-from-top-1 duration-150">
                      <div className="mb-2">
                        <p className="text-xs text-foreground/60 mb-2">
                          Get your free API key from{" "}
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-700 underline"
                          >
                            Google AI Studio
                          </a>
                        </p>
                      </div>
                      <div className="relative">
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => onApiKeyChange(e.target.value)}
                          placeholder="Enter your Gemini API key..."
                          className="w-full p-2 pr-16 bg-card border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded font-mono"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {apiKey && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onApiKeyChange("")
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs px-2 py-0.5 bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {apiKey ? (
                        <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Saved locally in your browser
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          Using server default (may have rate limits)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  <div className="my-1 border-t border-border" />

                  {/* Sign Out */}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

