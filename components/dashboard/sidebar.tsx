"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
import { LogoIcon } from "@/components/logo-icon"
import { type StudioTab, isValidStudioTab, getTabFromPathname } from "@/types/studio"
import { ThemeToggleWithLabel, ThemeToggleCollapsed } from "@/components/ui/theme-toggle"

interface MenuItem {
  id: StudioTab
  label: string
  href: string
  icon: React.ReactNode
  beta?: boolean
}

interface SidebarProps {
  activeTab?: StudioTab
  onTabChange?: (tab: StudioTab) => void
  isCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

const mainMenuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/studio/dashboard",
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
    id: "video",
    label: "Video",
    href: "/studio/create-video",
    beta: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    id: "video-history",
    label: "Video History",
    href: "/studio/video-history",
    beta: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-2.625 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m14.25 0h1.5" />
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
  const activeTab = propActiveTab ?? getTabFromPathname(pathname)


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
    if (onTabChange && isValidStudioTab(id)) {
      onTabChange(id)
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
        ${isCollapsed ? "w-[72px]" : "w-64"} bg-card border-r border-border
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo and Team Selector */}
        <div className="p-4 border-b border-border">
          <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors`}>
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
                const isActive = activeTab === item.id
                
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => handleItemClick(item.id)}
                      title={isCollapsed ? `${item.label}${item.beta ? " (Early Beta)" : ""}` : undefined}
                      className={`
                        w-full flex items-center ${isCollapsed ? "justify-center" : "gap-3 justify-between"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium transition-colors
                        ${isActive 
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                          : "text-foreground/70 hover:bg-accent hover:text-foreground"
                        }
                      `}
                    >
                      <div className={`flex items-center ${isCollapsed ? "" : "gap-3"} min-w-0`}>
                        <span className={isActive ? "text-emerald-600" : ""}>{item.icon}</span>
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {item.beta && !isCollapsed && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded font-medium shrink-0">
                          Early Beta
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
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
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                          : "text-foreground/70 hover:bg-accent hover:text-foreground"
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
            className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            {!isCollapsed && "Back to Home"}
          </Link>
          
          {/* Theme Toggle */}
          {isCollapsed ? <ThemeToggleCollapsed /> : <ThemeToggleWithLabel />}

          {/* Collapse Toggle Button - Desktop only */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`hidden lg:flex w-full items-center ${isCollapsed ? "justify-center" : "gap-3"} ${isCollapsed ? "px-2" : "px-3"} py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors`}
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

