"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useAction, useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"

const codeSample = (baseUrl: string, platformApiKey: string) => `curl -X POST "${baseUrl}/api/v1/generate" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${platformApiKey || "YOUR_PLATFORM_API_KEY"}" \\
  -d '{
    "provider": "openai",
    "model": "gpt-image-2",
    "prompt": "A cinematic product photo of a glass perfume bottle",
    "imageSize": "2K",
    "aspectRatio": "square"
  }'`

export default function StudioApiPage() {
  const providerCredentials = useQuery(api.apiKeys.getMyProviderCredentials, {})
  const platformKeySummary = useQuery(api.apiKeys.getPlatformApiKeySummary, {})
  const createPlatformApiKey = useAction(api.apiKeyActions.createPlatformApiKey)
  const revokePlatformApiKey = useMutation(api.apiKeys.revokePlatformApiKey)

  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  const [isRevokingKey, setIsRevokingKey] = useState(false)
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"

  const providerStatuses = useMemo(
    () => [
      {
        id: "gemini",
        label: "Gemini",
        configured: Boolean(providerCredentials?.google?.configured),
      },
      {
        id: "openai",
        label: "OpenAI",
        configured: Boolean(providerCredentials?.openai?.configured),
      },
    ],
    [providerCredentials],
  )

  const codeBlockClass =
    "overflow-x-auto rounded-xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-100 shadow-sm dark:bg-zinc-900"

  const copyToClipboard = async (value: string, successMessage: string) => {
    await navigator.clipboard.writeText(value)
    setMessage(successMessage)
  }

  const handleGenerateKey = async () => {
    setIsGeneratingKey(true)
    setMessage(null)

    try {
      const result = await createPlatformApiKey({})
      setGeneratedApiKey(result.apiKey)
      setMessage(result.rotated ? "Platform API key rotated successfully." : "Platform API key created successfully.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate API key.")
    } finally {
      setIsGeneratingKey(false)
    }
  }

  const handleRevokeKey = async () => {
    setIsRevokingKey(true)
    setMessage(null)

    try {
      const result = await revokePlatformApiKey({})
      setGeneratedApiKey(null)
      setMessage(result.revoked ? "Platform API key revoked." : "No active platform API key to revoke.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to revoke API key.")
    } finally {
      setIsRevokingKey(false)
    }
  }

  return (
    <div className="min-h-full bg-card">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="space-y-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">API</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate one platform API key, then send requests through Eikon while keeping your Gemini and OpenAI keys server-side.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {providerStatuses.map((provider) => (
              <div key={provider.id} className="rounded-xl border border-border p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{provider.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {provider.configured ? "Ready for gateway requests." : "Add your key in Settings before using this provider."}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      provider.configured
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {provider.configured ? "Configured" : "Missing"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Platform API key</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This is the key your external apps send to <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">/api/v1/generate</code>.
                </p>
              </div>
              {platformKeySummary ? (
                <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Active
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  Not generated
                </span>
              )}
            </div>

            {platformKeySummary && (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  Active key: <span className="font-mono text-foreground">{platformKeySummary.keyPreview}</span>
                </p>
                <p className="mt-1">Created: {new Date(platformKeySummary.createdAt).toLocaleString()}</p>
                {platformKeySummary.lastUsedAt && (
                  <p className="mt-1">Last used: {new Date(platformKeySummary.lastUsedAt).toLocaleString()}</p>
                )}
              </div>
            )}

            {generatedApiKey && (
              <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-4">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Copy this key now. For security, it is only shown once.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    readOnly
                    value={generatedApiKey}
                    className="w-full rounded-lg border border-emerald-500/30 bg-card px-3 py-2.5 font-mono text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedApiKey, "Platform API key copied.")}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-emerald-600"
                  >
                    Copy key
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateKey}
                disabled={isGeneratingKey}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingKey ? "Generating…" : platformKeySummary ? "Regenerate key" : "Generate key"}
              </button>
              <button
                type="button"
                onClick={handleRevokeKey}
                disabled={isRevokingKey || !platformKeySummary}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400"
              >
                {isRevokingKey ? "Revoking…" : "Revoke key"}
              </button>
              <Link
                href="/studio/settings"
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Manage provider keys
              </Link>
            </div>

            {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
          </div>

          <div className="rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground">Request format</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p><code className="rounded bg-secondary px-1.5 py-0.5 text-xs">Authorization: Bearer &lt;platform-api-key&gt;</code></p>
              <p><code className="rounded bg-secondary px-1.5 py-0.5 text-xs">provider</code> must be <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">gemini</code> or <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">openai</code>.</p>
              <p><code className="rounded bg-secondary px-1.5 py-0.5 text-xs">model</code> currently supports <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">gemini-3.1-flash-image</code>, <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">gemini-3-pro-image</code>, and <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">gpt-image-2</code>.</p>
            </div>

            <pre className={`mt-4 ${codeBlockClass}`}>
              {codeSample(baseUrl, generatedApiKey || "")}
            </pre>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(codeSample(baseUrl, generatedApiKey || "YOUR_PLATFORM_API_KEY"), "Code sample copied.")}
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Copy example
              </button>
              <Link
                href="/api-docs"
                className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Open full docs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
