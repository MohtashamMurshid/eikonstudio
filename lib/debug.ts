/**
 * Dev-only logger. No-op in production builds so that internal request
 * details (prompts, URLs, base64 sizes, etc.) never leak into server logs
 * of a deployed instance.
 *
 * Use `debug(...)` anywhere you would otherwise call `console.log(...)`
 * for non-essential diagnostics. Keep `console.error` for real errors
 * you want to surface in production.
 */
export const debug: (...args: unknown[]) => void =
  process.env.NODE_ENV !== "production"
    ? (...args) => console.log(...args)
    : () => {};
