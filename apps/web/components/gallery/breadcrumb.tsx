"use client"

import { memo } from "react"
import type { Id } from "@/convex/_generated/dataModel"

interface BreadcrumbProps {
  currentFolder: { _id: Id<"folders">; name: string } | null
  onNavigateToRoot: () => void
}

export const Breadcrumb = memo(({ currentFolder, onNavigateToRoot }: BreadcrumbProps) => {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <button
        onClick={onNavigateToRoot}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
          currentFolder 
            ? "text-foreground/60 hover:text-foreground hover:bg-secondary/50" 
            : "text-foreground font-medium"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        Gallery
      </button>
      
      {currentFolder && (
        <>
          <svg className="w-4 h-4 text-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="flex items-center gap-1.5 px-2 py-1 text-foreground font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {currentFolder.name}
          </span>
        </>
      )}
    </nav>
  )
})

Breadcrumb.displayName = "Breadcrumb"

