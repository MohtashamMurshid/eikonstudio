import { Button } from "@/components/ui/button"
import { randomPrompts } from "../constants"

interface PromptInputProps {
  prompt: string
  onPromptChange: (prompt: string) => void
  currentMode: "text-to-image" | "image-editing"
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}

export function PromptInput({ prompt, onPromptChange, currentMode, onKeyDown }: PromptInputProps) {
  const getRandomPrompt = () => {
    const randomIndex = Math.floor(Math.random() * randomPrompts.length)
    const randomPrompt = randomPrompts[randomIndex]
    onPromptChange(randomPrompt)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between select-none">
        <label className="text-sm font-medium text-foreground/70">
          {currentMode === "text-to-image" ? "Describe your image" : "Describe how to edit the image..."}
        </label>
        <Button
          onClick={getRandomPrompt}
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs bg-white border-border text-foreground hover:bg-gray-50"
        >
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <polyline points="16,3 21,3 21,8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21,16 21,21 16,21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          Random
        </Button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          currentMode === "text-to-image" ? "Describe the image you want to generate..." : "Describe how to edit the image..."
        }
        className="w-full h-28 md:h-32 p-4 bg-white border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-foreground text-sm placeholder:text-foreground/40 select-text transition-colors"
        style={{
          fontSize: "16px", // Prevents zoom on iOS Safari
          WebkitUserSelect: "text",
          userSelect: "text",
        }}
      />
    </div>
  )
}
