"use client"

import { useState, useEffect, useRef, useCallback, memo, useLayoutEffect, useMemo } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
import { builtInSkills, matchesSkillSearch, type SkillCategory, type SkillDefinition } from "@/lib/skill-library"

interface SkillAutocompleteProps {
  inputValue: string
  cursorPosition: number
  onSelect: (skillName: string, startIndex: number, endIndex: number) => void
  onClose: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

function findSkillAtCursor(text: string, cursorPos: number): { searchTerm: string; startIndex: number; endIndex: number } | null {
  let startIndex = cursorPos - 1
  while (startIndex >= 0) {
    const char = text[startIndex]
    if (/\s/.test(char)) return null
    if (char === "/") {
      const searchTerm = text.slice(startIndex + 1, cursorPos)
      return { searchTerm, startIndex, endIndex: cursorPos }
    }
    startIndex--
  }
  return null
}

function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): { top: number; left: number; lineHeight: number } {
  const mirror = document.createElement("div")
  const style = window.getComputedStyle(textarea)

  const properties = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle",
    "letterSpacing", "lineHeight", "textTransform", "wordSpacing",
    "textIndent", "paddingTop", "paddingRight", "paddingBottom",
    "paddingLeft", "borderTopWidth", "borderRightWidth",
    "borderBottomWidth", "borderLeftWidth", "boxSizing",
    "whiteSpace", "wordWrap", "overflowWrap",
  ] as const

  mirror.style.position = "absolute"
  mirror.style.visibility = "hidden"
  mirror.style.overflow = "hidden"
  mirror.style.width = `${textarea.clientWidth}px`

  for (const prop of properties) {
    mirror.style[prop as string] = style.getPropertyValue(
      prop.replace(/([A-Z])/g, "-$1").toLowerCase()
    )
  }

  const textBefore = textarea.value.slice(0, position)
  const textNode = document.createTextNode(textBefore)
  mirror.appendChild(textNode)

  const marker = document.createElement("span")
  marker.textContent = "\u200b"
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  const markerRect = marker.getBoundingClientRect()
  const mirrorRect = mirror.getBoundingClientRect()
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2

  const coords = {
    top: markerRect.top - mirrorRect.top - textarea.scrollTop,
    left: markerRect.left - mirrorRect.left - textarea.scrollLeft,
    lineHeight,
  }

  document.body.removeChild(mirror)
  return coords
}

export const SkillAutocomplete = memo(function SkillAutocomplete({
  inputValue,
  cursorPosition,
  onSelect,
  onClose,
  textareaRef,
}: SkillAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const skillMatch = findSkillAtCursor(inputValue, cursorPosition)

  const customSkills = useQuery(
    api.skills.searchCustomSkills,
    skillMatch !== null ? { searchTerm: skillMatch.searchTerm, limit: 50 } : "skip"
  )

  const combinedResults = useMemo<
    Array<{
      type: "built-in" | "custom"
      data: SkillDefinition & {
        _id?: string
        category?: SkillCategory | string
        builtInSkillKey?: string
      }
    }>
  >(() => {
    const matchingCustomSkills = (customSkills || []).filter((skill) =>
      matchesSkillSearch(skill, skillMatch?.searchTerm ?? ""),
    )
    const customSkillNameSet = new Set(matchingCustomSkills.map((skill) => skill.name))
    const matchingBuiltInSkills = builtInSkills
      .filter((skill) => !customSkillNameSet.has(skill.name))
      .filter((skill) => matchesSkillSearch(skill, skillMatch?.searchTerm ?? ""))

    return [
      ...matchingCustomSkills.map((skill) => ({ type: "custom" as const, data: skill })),
      ...matchingBuiltInSkills.map((skill) => ({ type: "built-in" as const, data: skill })),
    ]
  }, [customSkills, skillMatch?.searchTerm])

  const isLoading = skillMatch !== null && customSkills === undefined
  const showDropdown = skillMatch !== null && (combinedResults.length > 0 || isLoading)

  useLayoutEffect(() => {
    if (!showDropdown || !textareaRef.current || !skillMatch) {
      if (position !== null) setPosition(null)
      return
    }

    const textarea = textareaRef.current
    const textareaRect = textarea.getBoundingClientRect()
    const caret = getCaretCoordinates(textarea, skillMatch.startIndex)

    const newTop = textareaRect.top + caret.top
    const newLeft = textareaRect.left + caret.left

    setPosition((prev) => {
      if (prev && Math.abs(prev.top - newTop) < 1 && Math.abs(prev.left - newLeft) < 1) return prev
      return { top: newTop, left: newLeft }
    })
  }, [showDropdown, inputValue, skillMatch, textareaRef, position])

  useEffect(() => {
    setSelectedIndex(0)
  }, [combinedResults.length, skillMatch?.searchTerm])

  useEffect(() => {
    if (!dropdownRef.current) return
    const selected = dropdownRef.current.querySelector(`[data-index="${selectedIndex}"]`)
    if (selected) selected.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  const handleSelect = useCallback(
    (index: number) => {
      if (!skillMatch) return
      const item = combinedResults[index]
      if (!item) return
      onSelect(item.data.name, skillMatch.startIndex, skillMatch.endIndex)
    },
    [skillMatch, combinedResults, onSelect]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showDropdown) return
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev + 1) % combinedResults.length)
          break
        case "ArrowUp":
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) => (prev - 1 + combinedResults.length) % combinedResults.length)
          break
        case "Enter":
        case "Tab":
          e.preventDefault()
          e.stopPropagation()
          handleSelect(selectedIndex)
          break
        case "Escape":
          e.preventDefault()
          e.stopPropagation()
          onClose()
          break
      }
    },
    [showDropdown, combinedResults.length, selectedIndex, handleSelect, onClose]
  )

  useEffect(() => {
    if (showDropdown) {
      window.addEventListener("keydown", handleKeyDown, true)
      return () => window.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [showDropdown, handleKeyDown])

  useEffect(() => {
    if (!showDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showDropdown, onClose])

  if (!showDropdown || !position) return null

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[100] rounded-lg border border-border bg-card shadow-xl animate-in fade-in slide-in-from-bottom-1 duration-100"
      style={{
        bottom: `calc(100vh - ${position.top}px + 4px)`,
        left: Math.min(position.left, window.innerWidth - 280),
        width: "260px",
      }}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 px-3 py-2.5 text-muted-foreground">
          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs text-foreground/50">Searching skills...</span>
        </div>
      ) : (
        <div className="max-h-[240px] overflow-y-auto py-1">
          {combinedResults.map((item, index) => (
            <button
              key={`${item.type}-${item.data.name}`}
              data-index={index}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                index === selectedIndex ? "bg-indigo-500/10" : "hover:bg-secondary/50"
              }`}
              onClick={() => handleSelect(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="shrink-0 font-mono text-xs font-medium text-indigo-500">
                /{item.data.name}
              </span>
              <span className="truncate text-[11px] text-foreground/50">
                {item.data.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
