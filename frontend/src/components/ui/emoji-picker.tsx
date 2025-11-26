import * as React from "react"
import { Smile } from "lucide-react"

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  onClose?: () => void
}

const COMMON_EMOJIS = [
  "👍", "❤️", "😂", "😮", "😢", "😡",
  "🎉", "🔥", "👏", "💯", "✅", "❌",
  "🤔", "😊", "👀", "🙏", "💪", "🎯"
]

export const EmojiPicker = React.forwardRef<HTMLDivElement, EmojiPickerProps>(
  ({ onEmojiSelect, onClose }, ref) => {
    return (
      <>
        {/* Overlay to close picker */}
        {onClose && (
          <div
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
        )}

        <div
          ref={ref}
          className="absolute z-50 mt-2 bg-white rounded-lg shadow-lg border p-3 w-64"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b">
            <Smile className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Choisir une réaction</span>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onEmojiSelect(emoji)
                  onClose?.()
                }}
                className="text-2xl hover:bg-gray-100 rounded p-2 transition-colors"
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </>
    )
  }
)

EmojiPicker.displayName = "EmojiPicker"
