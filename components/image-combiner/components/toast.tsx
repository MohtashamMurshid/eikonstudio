import { cn } from "@/lib/utils"
import type { Toast } from "../types"

interface ToastProps {
  toast: Toast | null
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null

  const getToastStyles = () => {
    switch (toast.type) {
      case "success":
        return "bg-foreground/90 text-background"
      case "warning":
        return "bg-amber-600/90 text-white"
      case "error":
      default:
        return "bg-red-600/90 text-white"
    }
  }

  return (
    <div className="ui-overlay ui-toast fixed bottom-6 left-1/2 z-50 select-none">
      <div
        className={cn(
          "px-4 py-2.5 rounded-full shadow-lg text-sm font-medium backdrop-blur-sm",
          getToastStyles(),
        )}
      >
        {toast.message}
      </div>
    </div>
  )
}
