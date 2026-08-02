export interface GeneratedImage {
  url: string
  prompt: string
  description?: string
}

export interface ImageCombinerProps {
  providerApiKeys: {
    gemini: string
    openai: string
  }
}

export type ToastType = "success" | "error" | "warning"

export interface Toast {
  message: string
  type: ToastType
}

