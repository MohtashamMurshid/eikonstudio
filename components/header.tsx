"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

interface HeaderProps {
  apiKey: string
  onApiKeyChange: (key: string) => void
}

export function Header({ apiKey, onApiKeyChange }: HeaderProps) {
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)
  const router = useRouter()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showApiKeySection, setShowApiKeySection] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
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

  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-sm border-b border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2 select-none">
        <svg
          className="w-5 h-5 text-emerald-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span className="text-sm font-semibold text-white tracking-tight">PixelForge</span>
      </div>

      {/* User Menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => {
            setIsDropdownOpen(!isDropdownOpen)
            if (isDropdownOpen) setShowApiKeySection(false)
          }}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          {/* Avatar */}
          {displayImage ? (
            <img
              src={displayImage}
              alt={displayName}
              className="w-7 h-7 rounded-full object-cover border border-gray-700"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-medium text-white border border-emerald-500">
              {getInitials(displayName)}
            </div>
          )}
          
          {/* Name (hidden on mobile) */}
          <span className="hidden sm:block text-sm text-gray-300 max-w-[120px] truncate">
            {displayName}
          </span>
          
          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
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
          <div className="absolute right-0 mt-2 w-72 bg-black/95 backdrop-blur-md border border-gray-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-3">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={displayName}
                    className="w-10 h-10 rounded-full object-cover border border-gray-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-medium text-white border border-emerald-500">
                    {getInitials(displayName)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {/* API Key Section */}
              <button
                onClick={() => setShowApiKeySection(!showApiKeySection)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>API Key</span>
                </div>
                <div className="flex items-center gap-2">
                  {apiKey ? (
                    <span className="text-xs px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">Set</span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">Not set</span>
                  )}
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${showApiKeySection ? "rotate-180" : ""}`}
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
                <div className="px-4 py-3 bg-black/50 border-y border-gray-800 animate-in slide-in-from-top-1 duration-150">
                  <div className="mb-2">
                    <p className="text-xs text-gray-400 mb-2">
                      Get your free API key from{" "}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 underline"
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
                      className="w-full p-2 pr-16 bg-black/50 border border-gray-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded font-mono"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {apiKey && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onApiKeyChange("")
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs px-2 py-0.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {apiKey ? (
                    <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved locally in your browser
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Using server default (may have rate limits)
                    </p>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="my-1 border-t border-gray-800" />

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
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
    </header>
  )
}

