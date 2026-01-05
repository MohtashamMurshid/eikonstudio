"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
import { LogoIcon } from "@/components/logo-icon"

interface SidebarProps {
  activeTab?: "dashboard" | "studio" | "history" | "gallery" | "settings"
  onTabChange?: (tab: "dashboard" | "studio" | "history" | "gallery" | "settings") => void
  isCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

const mainMenuItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "#",
    comingSoon: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    id: "studio",
    label: "Studio",
    href: "/studio/create",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  {
    id: "history",
    label: "History",
    href: "/studio/history",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "gallery",
    label: "Gallery",
    href: "/studio/gallery",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
]

const analyticsItems = [
  {
    id: "usage",
    label: "Usage Stats",
    comingSoon: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    id: "reports",
    label: "Reports",
    comingSoon: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
]

const settingsItems = [
  {
    id: "settings",
    label: "Settings",
    href: "/studio/settings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
]

export function Sidebar({ activeTab: propActiveTab, onTabChange, isCollapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const isCollapsed = controlledCollapsed ?? internalCollapsed
  const setIsCollapsed = onCollapsedChange ?? setInternalCollapsed
  
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname()
  
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)
  
  const displayName = user?.name || session?.user?.name || "User"
  const displayEmail = user?.email || session?.user?.email || ""
  const displayImage = user?.image || session?.user?.image
  
  // Determine active tab from pathname or prop
  const getActiveTab = (): "dashboard" | "studio" | "history" | "gallery" | "settings" => {
    if (propActiveTab) return propActiveTab
    if (pathname?.includes("/dashboard")) return "dashboard"
    if (pathname?.includes("/history")) return "history"
    if (pathname?.includes("/gallery")) return "gallery"
    if (pathname?.includes("/settings")) return "settings"
    return "studio"
  }
  const activeTab = getActiveTab()


  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const handleItemClick = (id: string) => {
    if (onTabChange && (id === "dashboard" || id === "studio" || id === "history" || id === "gallery" || id === "settings")) {
      onTabChange(id as "dashboard" | "studio" | "history" | "gallery" | "settings")
    }
    // Close mobile sidebar after navigation
    setIsMobileOpen(false)
  }

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${isCollapsed ? "w-[72px]" : "w-64"} bg-white border-r border-border
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo and Team Selector */}
        <div className="p-4 border-b border-border">
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors`}>
            <div className="w-9 h-9 bg-foreground rounded-lg flex items-center justify-center flex-shrink-0">
              <LogoIcon className="w-5 h-5 text-background" />
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground/50 uppercase tracking-wider">Workspace</p>
                  <p className="text-sm font-semibold text-foreground truncate">Eikon Studio</p>
                </div>
                <svg className="w-4 h-4 text-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                </svg>
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto ${isCollapsed ? "p-2" : "p-4"} space-y-6`}>
          {/* Main Menu */}
          <div>
            {!isCollapsed && <p className="px-3 mb-2 text-xs font-medium text-foreground/40 uppercase tracking-wider">Main Menu</p>}
            <ul className="space-y-1">
              {mainMenuItems.map((item) => {
                const isActive = (item.id === "dashboard" || item.id === "studio" || item.id === "history" || item.id === "gallery") && activeTab === item.id
                const isDisabled = item.href === "#"
                
                if (isDisabled || item.comingSoon) {
                  return (
                    <li key={item.id}>
                      <div
                        title={isCollapsed ? `${item.label} - Coming Soon` : undefined}
                        className={`
                          w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3 justify-between"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium
                          text-foreground/40 cursor-not-allowed
                        `}
                      >
                        <div className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
                          {item.icon}
                          {!isCollapsed && item.label}
                        </div>
                        {!isCollapsed && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-foreground/10 text-foreground/40 rounded font-medium">
                            Soon
                          </span>
                        )}
                      </div>
                    </li>
                  )
                }
                
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => handleItemClick(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium transition-colors
                        ${isActive 
                          ? "bg-emerald-50 text-emerald-700" 
                          : "text-foreground/70 hover:bg-gray-50 hover:text-foreground"
                        }
                      `}
                    >
                      <span className={isActive ? "text-emerald-600" : ""}>{item.icon}</span>
                      {!isCollapsed && item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Analytics */}
          <div>
            {!isCollapsed && <p className="px-3 mb-2 text-xs font-medium text-foreground/40 uppercase tracking-wider">Analytics</p>}
            <ul className="space-y-1">
              {analyticsItems.map((item) => (
                <li key={item.id}>
                  <div
                    title={isCollapsed ? `${item.label} - Coming Soon` : undefined}
                    className={`w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3 justify-between"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium text-foreground/40 cursor-not-allowed`}
                  >
                    <div className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
                      {item.icon}
                      {!isCollapsed && item.label}
                    </div>
                    {!isCollapsed && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-foreground/10 text-foreground/40 rounded font-medium">
                        Soon
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Settings */}
          <div>
            {!isCollapsed && <p className="px-3 mb-2 text-xs font-medium text-foreground/40 uppercase tracking-wider">Settings</p>}
            <ul className="space-y-1">
              {settingsItems.map((item) => {
                const isActive = activeTab === item.id
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => handleItemClick(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={`
                        w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium transition-colors
                        ${isActive 
                          ? "bg-emerald-50 text-emerald-700" 
                          : "text-foreground/70 hover:bg-gray-50 hover:text-foreground"
                        }
                      `}
                    >
                      <span className={isActive ? "text-emerald-600" : ""}>{item.icon}</span>
                      {!isCollapsed && item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* Studio Info Section - shown when in studio tab */}

        {/* User Profile & Footer */}
        <div className={`${isCollapsed ? "p-2" : "p-4"} border-t border-border space-y-2`}>
          {/* User Info */}
          <div
            title={isCollapsed ? displayName : undefined}
            className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium`}
          >
            {displayImage ? (
              <img
                src={displayImage}
                alt={displayName}
                className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                {getInitials(displayName)}
              </div>
            )}
            {!isCollapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                <p className="text-xs text-foreground/50 truncate">{displayEmail}</p>
              </div>
            )}
          </div>

          {/* Back to Home */}
          <Link
            href="/"
            title={isCollapsed ? "Back to Home" : undefined}
            className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-gray-50 hover:text-foreground transition-colors`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            {!isCollapsed && "Back to Home"}
          </Link>
          
          {/* Collapse Toggle Button - Desktop only */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden lg:flex w-full items-center ${isCollapsed ? "justify-center" : "gap-3"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-gray-50 hover:text-foreground transition-colors`}
          >
            <svg className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
            {!isCollapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed bottom-4 left-4 z-50 lg:hidden w-12 h-12 bg-foreground text-background rounded-full shadow-lg flex items-center justify-center"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
    </>
  )
}

