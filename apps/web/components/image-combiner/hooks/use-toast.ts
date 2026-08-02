import { useState } from "react"
import type { Toast } from "../types"

/**
 * Hook for showing toasts
 * @returns The toast hook
 */
export const useToast = () => {
  const [toast, setToast] = useState<Toast | null>(null)

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  return { toast, showToast }
}

