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
        return "border-emerald-200 text-emerald-800"
      case "warning":
        return "border-amber-200 text-amber-800"
      case "error":
      default:
        return "border-red-200 text-red-800"
    }
  }

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case "warning":
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        )
      case "error":
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300 select-none">
      <div
        className={cn(
          "bg-white backdrop-blur-sm border rounded-xl p-4 shadow-lg max-w-sm",
          getToastStyles(),
        )}
      >
        <div className="flex items-center gap-3">
          {getIcon()}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      </div>
    </div>
  )
}
