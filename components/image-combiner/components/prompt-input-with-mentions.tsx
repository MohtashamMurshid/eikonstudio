import { useRef } from "react"
import { MentionAutocomplete } from "./mention-autocomplete"

interface PromptInputWithMentionsProps {
  prompt: string
  cursorPosition: number
  showMentionDropdown: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement>
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
}

export function PromptInputWithMentions({
  prompt,
  cursorPosition,
  showMentionDropdown,
  textareaRef,
  onPromptChange,
  onKeyDown,
  onCursorChange,
  onMentionSelect,
  onCloseMentionDropdown,
}: PromptInputWithMentionsProps) {
  return (
    <div className="p-3 sm:p-4 pb-2 relative">
      {/* Highlight backdrop - renders text with @mentions highlighted (supports @folder/filename) */}
      <div
        className="absolute inset-0 p-3 sm:p-4 pb-2 pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-sm sm:text-base text-foreground"
        style={{ fontSize: "16px", lineHeight: "1.5" }}
        aria-hidden="true"
      >
        {prompt.split(/(@[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?)/).map((part, i) =>
          part.match(/^@[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)?$/) ? (
            <span key={i} className="bg-emerald-500/15 text-emerald-600 rounded-sm">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={onPromptChange}
        onKeyDown={onKeyDown}
        onSelect={(e) => onCursorChange((e.target as HTMLTextAreaElement).selectionStart || 0)}
        onClick={(e) => onCursorChange((e.target as HTMLTextAreaElement).selectionStart || 0)}
        placeholder="Describe the image you want to generate... (type @ to reference gallery images)"
        className="w-full min-h-[60px] sm:min-h-[80px] max-h-[120px] sm:max-h-[160px] bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-transparent caret-foreground text-sm sm:text-base placeholder:text-foreground/40 select-text relative z-10"
        style={{
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
          textareaRef={textareaRef as React.RefObject<HTMLTextAreaElement>}
        />
      )}
    </div>
  )
}

