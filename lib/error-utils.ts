import { ConvexError } from "convex/values"

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "PROVIDER_CONFIG_ERROR"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_RESPONSE_ERROR"
  | "UPLOAD_ERROR"
  | "UNKNOWN"

export interface AppErrorData {
  code: AppErrorCode
  message: string
  retryable?: boolean
}

export function createAppError(
  code: AppErrorCode,
  message: string,
  options?: Pick<AppErrorData, "retryable">,
): AppErrorData {
  return {
    code,
    message,
    retryable: options?.retryable,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function getErrorData(error: unknown): AppErrorData | null {
  if (error instanceof ConvexError) {
    const { data } = error

    if (typeof data === "string" && data.trim()) {
      return createAppError("UNKNOWN", data.trim())
    }

    if (isRecord(data) && typeof data.message === "string" && data.message.trim()) {
      return {
        code: typeof data.code === "string" ? (data.code as AppErrorCode) : "UNKNOWN",
        message: data.message.trim(),
        retryable: typeof data.retryable === "boolean" ? data.retryable : undefined,
      }
    }
  }

  return null
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const errorData = getErrorData(error)
  if (errorData?.message) {
    return errorData.message
  }

  if (error instanceof Error) {
    const message = error.message.trim()
    if (!message || message === "Server Error" || message.startsWith("[CONVEX")) {
      return fallback
    }
    return message
  }

  return fallback
}
