import { cn } from "@/lib/utils"
import type { Toast } from "../types"

interface ToastProps {
  toast: Toast | null
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300 select-none">
      <div
        className={cn(
          "bg-black/90 backdrop-blur-sm border rounded-lg p-4 shadow-lg max-w-sm",
          toast.type === "success" ? "border-green-500/50 text-green-100" : "border-red-500/50 text-red-100",
        )}
      >
        <div className="flex items-center gap-3">
          {toast.type === "success" ? (
            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12m0 0l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      </div>
    </div>
  )
}

