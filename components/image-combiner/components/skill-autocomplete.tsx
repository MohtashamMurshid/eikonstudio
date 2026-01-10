"use client"

import { useState, useEffect, useRef, useCallback, memo, useLayoutEffect } from "react"
import { useQuery } from "convex-helpers/react/cache/hooks"
import { api } from "@/convex/_generated/api"
import { predefinedSkills, type Skill } from "../constants"

interface SkillAutocompleteProps {
  inputValue: string
  cursorPosition: number
  onSelect: (skillName: string, startIndex: number, endIndex: number) => void
  onClose: () => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

// Find the / skill being typed at cursor position
function findSkillAtCursor(text: string, cursorPos: number): { searchTerm: string; startIndex: number; endIndex: number } | null {
  // Look backwards from cursor to find /
  let startIndex = cursorPos - 1
  while (startIndex >= 0) {
    const char = text[startIndex]
    // If we hit whitespace or start of text before /, no skill
    if (/\s/.test(char)) {
      return null
    }
    if (char === "/") {
      // Found / - now extract the search term
      const searchTerm = text.slice(startIndex + 1, cursorPos)
      return {
        searchTerm,
        startIndex,
        endIndex: cursorPos,
      }
    }
    startIndex--
  }
  return null
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

  // Find skill at cursor
  const skillMatch = findSkillAtCursor(inputValue, cursorPosition)
  
  // Query custom skills from database
  const customSkills = useQuery(
    api.skills.searchCustomSkills,
    skillMatch !== null ? { searchTerm: skillMatch.searchTerm, limit: 6 } : "skip"
  )

  // Filter predefined skills based on search term (client-side for instant results)
  const filteredPredefinedSkills = skillMatch
    ? predefinedSkills.filter(
        (skill) =>
          skill.name.includes(skillMatch.searchTerm.toLowerCase()) ||
          skill.description.toLowerCase().includes(skillMatch.searchTerm.toLowerCase())
      )
    : []

  // Combine predefined and custom skills
  const combinedResults: Array<{ type: "predefined" | "custom"; data: Skill & { _id?: string } }> = [
    ...filteredPredefinedSkills.slice(0, 6).map((s) => ({ type: "predefined" as const, data: s })),
    ...(customSkills || []).slice(0, 4).map((s) => ({ type: "custom" as const, data: s })),
  ]

  const isLoading = skillMatch !== null && customSkills === undefined
  const showDropdown = skillMatch !== null && (combinedResults.length > 0 || isLoading)

  // Calculate dropdown position based on "/" position - positioned ABOVE the /
  useLayoutEffect(() => {
    if (!showDropdown || !textareaRef.current || !skillMatch) {
      if (position !== null) {
        setPosition(null)
      }
      return
    }

    const textarea = textareaRef.current
    const textareaRect = textarea.getBoundingClientRect()
    
    const textBeforeSlash = inputValue.slice(0, skillMatch.startIndex)
    const computedStyle = window.getComputedStyle(textarea)
    
    const lines = textBeforeSlash.split("\n")
    const lastLine = lines[lines.length - 1]
    
    const avgCharWidth = 8
    const xOffset = Math.max(0, lastLine.length * avgCharWidth)
    const paddingLeft = parseInt(computedStyle.paddingLeft) || 12

    const newTop = textareaRect.top - 8
    const newLeft = textareaRect.left + paddingLeft + Math.min(xOffset, textarea.clientWidth - 200)

    setPosition((prev) => {
      if (prev?.top === newTop && prev?.left === newLeft) {
        return prev
      }
      return { top: newTop, left: newLeft }
    })
  }, [showDropdown, inputValue, skillMatch, textareaRef, combinedResults.length, position])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [combinedResults.length, skillMatch?.searchTerm])

  // Handle selection
  const handleSelect = useCallback(
    (index: number) => {
      if (!skillMatch) return

      const item = combinedResults[index]
      if (!item) return

      onSelect(item.data.name, skillMatch.startIndex, skillMatch.endIndex)
    },
    [skillMatch, combinedResults, onSelect]
  )

  // Keyboard navigation
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

  // Click outside to close
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

  const dropdownHeight = isLoading ? 32 : Math.min(combinedResults.length, 10) * 28 + 8

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[100] bg-white border border-border rounded-lg shadow-lg overflow-hidden animate-in fade-in duration-100"
      style={{
        top: position.top - dropdownHeight,
        left: position.left,
        minWidth: "120px",
        maxWidth: "180px",
      }}
    >
      {isLoading ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-muted-foreground">
          <svg
            className="animate-spin h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-xs">...</span>
        </div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto py-1">
          {combinedResults.map((item, index) => (
            <button
              key={`${item.type}-${item.data.name}`}
              className={`w-full px-2.5 py-1 text-left transition-colors ${
                index === selectedIndex ? "bg-indigo-50" : "hover:bg-secondary/50"
              }`}
              onClick={() => handleSelect(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className={`text-xs font-medium ${
                item.type === "custom" ? "text-violet-600" : "text-indigo-600"
              }`}>
                /{item.data.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
