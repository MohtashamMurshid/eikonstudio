import { predefinedArtStyles } from "../constants"

interface ArtStyleSuggestionsProps {
  selectedArtStyle: string
  onArtStyleToggle: (style: string) => void
}

export function ArtStyleSuggestions({ selectedArtStyle, onArtStyleToggle }: ArtStyleSuggestionsProps) {
  // Art style suggestions (show first 4)
  const artStyleSuggestions = predefinedArtStyles.slice(0, 4)

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4">
      {artStyleSuggestions.map((style) => (
        <button
          key={style}
          onClick={() => onArtStyleToggle(style)}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border text-xs sm:text-sm transition-all ${
            selectedArtStyle === style
              ? "border-foreground/30 bg-foreground/10 text-foreground"
              : "border-border bg-card hover:bg-secondary/50 text-foreground/80 hover:text-foreground"
          }`}
        >
          <span>{style}</span>
        </button>
      ))}
    </div>
  )
}

