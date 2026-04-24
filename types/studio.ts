// Single source of truth for studio tab types

export type StudioTab = "dashboard" | "studio" | "history" | "gallery" | "settings" | "api" | "video" | "video-history"

export const STUDIO_TABS: StudioTab[] = ["dashboard", "studio", "history", "gallery", "settings", "api", "video", "video-history"]

export const isValidStudioTab = (id: string): id is StudioTab => STUDIO_TABS.includes(id as StudioTab)

// Route mapping for tabs
export const TAB_ROUTES: Record<StudioTab, string> = {
  dashboard: "/studio/dashboard",
  studio: "/studio/create",
  video: "/studio/create-video",
  "video-history": "/studio/video-history",
  history: "/studio/history",
  gallery: "/studio/gallery",
  settings: "/studio/settings",
  api: "/studio/api",
}

// Get tab from pathname
export function getTabFromPathname(pathname: string | null): StudioTab {
  if (!pathname) return "studio"

  // Check exact matches first (order matters for overlapping paths)
  if (pathname === "/studio/dashboard") return "dashboard"
  if (pathname === "/studio/video-history") return "video-history"
  if (pathname === "/studio/create-video") return "video"
  if (pathname === "/studio/history") return "history"
  if (pathname === "/studio/gallery") return "gallery"
  if (pathname === "/studio/api") return "api"
  if (pathname === "/studio/settings") return "settings"
  if (pathname === "/studio/create") return "studio"

  return "studio"
}
