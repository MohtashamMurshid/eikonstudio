import { useState, useCallback, useRef } from "react"

interface UseSkillHandlerProps {
  prompt: string
  setPrompt: (prompt: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * Hook for handling /skill slash commands in the prompt
 * Similar to mention handler but for skills
 */
export function useSkillHandler({
  prompt,
  setPrompt,
  textareaRef,
}: UseSkillHandlerProps) {
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showSkillDropdown, setShowSkillDropdown] = useState(false)
  const expectedPromptRef = useRef<string | null>(null)

  const handleSkillSelect = useCallback(
    (skillName: string, startIndex: number, endIndex: number) => {
      // Replace partial /... with complete /skillname + space
      const before = prompt.slice(0, startIndex)
      const after = prompt.slice(endIndex)
      // Add space after /skillname so user can continue typing immediately
      const newPrompt = `${before}/${skillName} ${after.trimStart()}`
      
      // Store expected prompt to guard against stale cursor repositioning
      expectedPromptRef.current = newPrompt
      setPrompt(newPrompt)
      setShowSkillDropdown(false)

      // Focus textarea and place cursor after the /skillname + space
      const expectedPrompt = newPrompt
      setTimeout(() => {
        // Only reposition cursor if user hasn't typed (prompt unchanged)
        if (textareaRef.current && expectedPromptRef.current === expectedPrompt) {
          textareaRef.current.focus()
          const newCursorPos = startIndex + skillName.length + 2 // +2 for / and space
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
          setCursorPosition(newCursorPos)
        }
        // Clear the expected prompt ref
        expectedPromptRef.current = null
      }, 0)
    },
    [prompt, textareaRef, setPrompt]
  )

  const checkForSkillTrigger = useCallback(
    (text: string, cursor: number) => {
      let slashIndex = -1
      for (let i = cursor - 1; i >= 0; i--) {
        if (/\s/.test(text[i])) break
        if (text[i] === "/") {
          slashIndex = i
          break
        }
      }

      const isSlashCommand =
        slashIndex >= 0 && (slashIndex === 0 || /\s/.test(text[slashIndex - 1] ?? ""))

      setShowSkillDropdown(isSlashCommand)
    },
    []
  )

  const handlePromptChangeForSkills = useCallback(
    (newText: string, cursorPos: number) => {
      // Clear expected prompt ref to prevent stale cursor repositioning
      expectedPromptRef.current = null
      setCursorPosition(cursorPos)
      checkForSkillTrigger(newText, cursorPos)
    },
    [checkForSkillTrigger]
  )

  return {
    skillCursorPosition: cursorPosition,
    setSkillCursorPosition: setCursorPosition,
    showSkillDropdown,
    setShowSkillDropdown,
    handleSkillSelect,
    handlePromptChangeForSkills,
  }
}
