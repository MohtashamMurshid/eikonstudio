import { useEffect, useState } from "react"
import { MentionAutocomplete } from "./mention-autocomplete"
import { SkillAutocomplete } from "./skill-autocomplete"

const MIN_TEXTAREA_HEIGHT = 80
const MAX_TEXTAREA_HEIGHT = 240

interface PromptInputWithMentionsProps {
  prompt: string
  cursorPosition: number
  showMentionDropdown: boolean
  showSkillDropdown: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onCursorChange: (position: number) => void
  onMentionSelect: (
    filename: string,
    startIndex: number,
    endIndex: number,
    imageData: string | string[],
    isFolder?: boolean
  ) => void
  onCloseMentionDropdown: () => void
  onSkillSelect: (skillName: string, startIndex: number, endIndex: number) => void
  onCloseSkillDropdown: () => void
}

// Helper function to highlight both @mentions (green) and /skills (blue) in the prompt
function highlightPrompt(text: string) {
  // Combined pattern to split by either
  const combinedPattern = /(@[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?|\/[a-zA-Z0-9-]+)/

  return text.split(combinedPattern).map((part, i) => {
    if (part.match(/^@[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/)) {
      // @mention - green/emerald
      return (
        <span key={i} className="bg-emerald-500/15 text-emerald-600 rounded-sm">
          {part}
        </span>
      )
    } else if (part.match(/^\/[a-zA-Z0-9-]+$/)) {
      // /skill - blue/indigo
      return (
        <span key={i} className="bg-indigo-500/15 text-indigo-600 rounded-sm">
          {part}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function PromptInputWithMentions({
  prompt,
  cursorPosition,
  showMentionDropdown,
  showSkillDropdown,
  textareaRef,
  onPromptChange,
  onKeyDown,
  onCursorChange,
  onMentionSelect,
  onCloseMentionDropdown,
  onSkillSelect,
  onCloseSkillDropdown,
}: PromptInputWithMentionsProps) {
  const [textareaHeight, setTextareaHeight] = useState(MIN_TEXTAREA_HEIGHT)
  const [scrollTop, setScrollTop] = useState(0)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = "0px"
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)

    textarea.style.height = `${nextHeight}px`
    setTextareaHeight(nextHeight)
    setIsOverflowing(textarea.scrollHeight > MAX_TEXTAREA_HEIGHT)

    if (textarea.scrollHeight <= MAX_TEXTAREA_HEIGHT) {
      textarea.scrollTop = 0
      setScrollTop(0)
    }
  }, [prompt, textareaRef])

  return (
    <div className="p-3 sm:p-4 pb-2 relative">
      {/* Highlight backdrop - renders text with @mentions (green) and /skills (blue) highlighted */}
      <div
        className="absolute inset-0 p-3 sm:p-4 pb-2 pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-sm sm:text-base text-foreground"
        style={{ fontSize: "16px", lineHeight: "1.5" }}
        aria-hidden="true"
      >
        <div style={{ transform: `translateY(-${scrollTop}px)` }}>{highlightPrompt(prompt)}</div>
      </div>
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={onPromptChange}
        onKeyDown={onKeyDown}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onSelect={(e) => onCursorChange((e.target as HTMLTextAreaElement).selectionStart || 0)}
        onClick={(e) => onCursorChange((e.target as HTMLTextAreaElement).selectionStart || 0)}
        placeholder="Describe the image you want to generate... (@ for gallery, /renaissance for skills)"
        className="w-full min-h-[60px] bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-transparent caret-foreground text-sm sm:text-base placeholder:text-foreground/40 select-text relative z-10"
        style={{
          height: `${textareaHeight}px`,
          maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
          overflowY: isOverflowing ? "auto" : "hidden",
          fontSize: "16px",
          WebkitUserSelect: "text",
          userSelect: "text",
          lineHeight: "1.5",
        }}
      />

      {/* Mention Autocomplete Dropdown */}
      {showMentionDropdown && (
        <MentionAutocomplete
          inputValue={prompt}
          cursorPosition={cursorPosition}
          onSelect={onMentionSelect}
          onClose={onCloseMentionDropdown}
          textareaRef={textareaRef}
        />
      )}

      {/* Skill Autocomplete Dropdown */}
      {showSkillDropdown && (
        <SkillAutocomplete
          inputValue={prompt}
          cursorPosition={cursorPosition}
          onSelect={onSkillSelect}
          onClose={onCloseSkillDropdown}
          textareaRef={textareaRef}
        />
      )}
    </div>
  )
}

