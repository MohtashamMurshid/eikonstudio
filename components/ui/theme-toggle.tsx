"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors"
        aria-label="Toggle theme"
      >
        <span className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="ui-pressable relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 opacity-100 transition-[transform,opacity] duration-150 ease-[var(--ease-ui-out)] dark:-rotate-90 dark:scale-90 dark:opacity-0 motion-reduce:transform-none" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-90 opacity-0 transition-[transform,opacity] duration-150 ease-[var(--ease-ui-out)] dark:rotate-0 dark:scale-100 dark:opacity-100 motion-reduce:transform-none" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}

export function ThemeToggleWithLabel() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors">
        <span className="w-5 h-5" />
        <span>Theme</span>
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="ui-pressable w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground"
    >
      <div className="relative w-5 h-5">
        <Sun className="h-5 w-5 rotate-0 scale-100 opacity-100 transition-[transform,opacity] duration-150 ease-[var(--ease-ui-out)] dark:-rotate-90 dark:scale-90 dark:opacity-0 motion-reduce:transform-none" />
        <Moon className="absolute inset-0 h-5 w-5 rotate-90 scale-90 opacity-0 transition-[transform,opacity] duration-150 ease-[var(--ease-ui-out)] dark:rotate-0 dark:scale-100 dark:opacity-100 motion-reduce:transform-none" />
      </div>
      <span>{resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
    </button>
  )
}

export function ThemeToggleCollapsed() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button
        className="w-full flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
        title="Toggle theme"
      >
        <span className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="ui-pressable w-full flex items-center justify-center px-2 py-2.5 rounded-lg text-sm font-medium text-foreground/70 hover:bg-accent hover:text-foreground"
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <div className="relative w-5 h-5">
        <Sun className="h-5 w-5 rotate-0 scale-100 opacity-100 transition-[transform,opacity] duration-150 ease-[var(--ease-ui-out)] dark:-rotate-90 dark:scale-90 dark:opacity-0 motion-reduce:transform-none" />
        <Moon className="absolute inset-0 h-5 w-5 rotate-90 scale-90 opacity-0 transition-[transform,opacity] duration-150 ease-[var(--ease-ui-out)] dark:rotate-0 dark:scale-100 dark:opacity-100 motion-reduce:transform-none" />
      </div>
    </button>
  )
}
