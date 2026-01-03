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
    <div className="space-y-3 md:space-y-6">
      <div className="flex items-center justify-between mb-3 md:mb-6 select-none">
        <label className="text-xs md:text-sm font-medium text-gray-300">
          {currentMode === "text-to-image" ? "Describe your image" : "Describe how to edit the image..."}
        </label>
        <Button
          onClick={getRandomPrompt}
          variant="outline"
          size="sm"
          className="h-6 md:h-8 px-2 md:px-3 text-xs bg-transparent border-gray-600 text-white hover:bg-gray-700 hover:text-white w-fit"
        >
          <svg className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        className="w-full h-16 md:h-32 p-2 md:p-4 bg-black/50 border border-gray-600 rounded resize-none focus:outline-none focus:ring-2 focus:ring-white text-white text-xs md:text-base select-text"
        style={{
          fontSize: "16px", // Prevents zoom on iOS Safari
          WebkitUserSelect: "text",
          userSelect: "text",
        }}
      />
    </div>
  )
}

