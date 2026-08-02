"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useConvexAuth } from "convex/react"
import { Logo } from "@/components/logo"
import { LogoLoader } from "@/components/logo-icon"

type CodeLanguage = "curl" | "javascript" | "python"
type Provider = "gemini" | "openai"
type ImageSize = "1K" | "2K" | "4K"
type AspectRatio = "square" | "portrait" | "landscape" | "wide"

interface ApiResponse {
  url?: string
  prompt?: string
  metadata?: {
    imageSize: string
    aspectRatio: string
    mode: string
    provider: Provider
    model: string
  }
  error?: string
  details?: string
}

const providerModels: Record<Provider, string> = {
  gemini: "gemini-3.1-flash-image-preview",
  openai: "gpt-image-2",
}

export default function ApiDocsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const router = useRouter()

  const [activeCodeTab, setActiveCodeTab] = useState<CodeLanguage>("curl")
  const [provider, setProvider] = useState<Provider>("openai")
  const [platformApiKey, setPlatformApiKey] = useState("")
  const [playgroundPrompt, setPlaygroundPrompt] = useState("")
  const [playgroundSize, setPlaygroundSize] = useState<ImageSize>("2K")
  const [playgroundAspectRatio, setPlaygroundAspectRatio] = useState<AspectRatio>("square")
  const [isGenerating, setIsGenerating] = useState(false)
  const [playgroundResult, setPlaygroundResult] = useState<ApiResponse | null>(null)
  const [showResponseJson, setShowResponseJson] = useState(false)

  useEffect(() => {
    const savedApiKey = localStorage.getItem("eikon-platform-api-key")
    if (savedApiKey) {
      setPlatformApiKey(savedApiKey)
    }
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth")
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (platformApiKey) {
      localStorage.setItem("eikon-platform-api-key", platformApiKey)
    } else {
      localStorage.removeItem("eikon-platform-api-key")
    }
  }, [platformApiKey])

  const handleGenerate = async () => {
    if (!playgroundPrompt.trim()) return

    setIsGenerating(true)
    setPlaygroundResult(null)

    try {
      const response = await fetch("/api/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(platformApiKey ? { Authorization: `Bearer ${platformApiKey}` } : {}),
        },
        body: JSON.stringify({
          provider,
          model: providerModels[provider],
          prompt: playgroundPrompt,
          imageSize: playgroundSize,
          aspectRatio: playgroundAspectRatio,
        }),
      })

      const data = (await response.json()) as ApiResponse
      setPlaygroundResult(data)
    } catch (error) {
      setPlaygroundResult({
        error: "Request failed",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"

  const codeExamples = useMemo<Record<CodeLanguage, string>>(
    () => ({
      curl: `curl -X POST "${baseUrl}/api/v1/generate" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PLATFORM_API_KEY" \\
  -d '{
    "provider": "${provider}",
    "model": "${providerModels[provider]}",
    "prompt": "A serene mountain landscape at sunset",
    "imageSize": "2K",
    "aspectRatio": "landscape"
  }'`,
      javascript: `const response = await fetch("${baseUrl}/api/v1/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_PLATFORM_API_KEY",
  },
  body: JSON.stringify({
    provider: "${provider}",
    model: "${providerModels[provider]}",
    prompt: "A serene mountain landscape at sunset",
    imageSize: "2K",
    aspectRatio: "landscape",
  }),
});

const data = await response.json();
console.log(data.url);`,
      python: `import requests

response = requests.post(
    "${baseUrl}/api/v1/generate",
    headers={
        "Authorization": "Bearer YOUR_PLATFORM_API_KEY",
    },
    json={
        "provider": "${provider}",
        "model": "${providerModels[provider]}",
        "prompt": "A serene mountain landscape at sunset",
        "imageSize": "2K",
        "aspectRatio": "landscape",
    }
)

data = response.json()
print(data["url"])`,
    }),
    [baseUrl, provider],
  )

  const badgeSurfaceClass = "rounded-lg border border-border bg-secondary/70 px-4 py-2 backdrop-blur-sm"
  const inlineCodeClass = "rounded bg-secondary px-1.5 py-0.5 text-foreground"
  const codeBlockClass =
    "overflow-x-auto rounded-xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-100 shadow-sm dark:bg-zinc-900"

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background select-none">
        <LogoLoader size="lg" text="Loading" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background select-none">
        <LogoLoader size="lg" text="Redirecting" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-foreground/60 transition-colors hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>

          <h1 className="mb-4 text-5xl font-serif font-normal tracking-tight text-foreground">API</h1>
          <p className="max-w-2xl text-base leading-relaxed text-foreground/60">
            Use one Eikon platform API key to access image generation with the Gemini or OpenAI credentials you already saved in your dashboard.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <div className={badgeSurfaceClass}>
              <span className="block text-xs text-foreground/50">Endpoint</span>
              <code className="text-sm text-foreground">/api/v1/generate</code>
            </div>
            <div className={badgeSurfaceClass}>
              <span className="block text-xs text-foreground/50">Method</span>
              <code className="text-sm text-foreground">POST</code>
            </div>
            <div className={badgeSurfaceClass}>
              <span className="block text-xs text-foreground/50">Auth</span>
              <code className="text-sm text-foreground">Bearer platform key</code>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-16 px-6 py-16">
        <section className="rounded-2xl border border-border bg-card p-8">
          <h2 className="text-2xl font-serif font-normal text-foreground">Authentication</h2>
          <p className="mt-4 text-sm leading-relaxed text-foreground/70">
            Generate your platform API key in the dashboard API section, then send it in the <code className={inlineCodeClass}>Authorization</code> header.
          </p>
          <pre className={`mt-4 ${codeBlockClass}`}>{`Authorization: Bearer YOUR_PLATFORM_API_KEY`}</pre>
          <p className="mt-4 text-sm text-foreground/60">
            The request body selects which saved provider key to use via <code className={inlineCodeClass}>provider</code> and <code className={inlineCodeClass}>model</code>.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-8">
          <h2 className="text-2xl font-serif font-normal text-foreground">Request Body</h2>
          <div className="mt-6 space-y-4 text-sm">
            {[
              ["prompt", "required", "string", "Text description of the image to generate."],
              ["provider", "required", "string", "One of `gemini` or `openai`."],
              ["model", "optional", "string", "Current models: `gemini-3.1-flash-image-preview`, `gpt-image-2`."],
              ["imageSize", "optional", "string", "One of `1K`, `2K`, or `4K`. Default: `2K`."],
              ["aspectRatio", "optional", "string", "One of `square`, `portrait`, `landscape`, or `wide`. Default: `square`."],
            ].map(([name, required, type, description]) => (
              <div key={name} className="border-b border-border pb-4 last:border-b-0">
                <div className="mb-1 flex items-center gap-2">
                  <code className="text-sm text-foreground">{name}</code>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-foreground/70">{required}</span>
                  <span className="text-xs text-foreground/50">{type}</span>
                </div>
                <p className="text-foreground/60">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-serif font-normal text-foreground">Code Examples</h2>
            <div className="flex gap-2">
              {(["curl", "javascript", "python"] as CodeLanguage[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveCodeTab(lang)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeCodeTab === lang
                      ? "bg-emerald-500 text-white"
                      : "border border-border bg-secondary/70 text-foreground/70 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {lang === "curl" ? "cURL" : lang === "javascript" ? "JavaScript" : "Python"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["gemini", "openai"] as Provider[]).map((providerOption) => (
              <button
                key={providerOption}
                onClick={() => setProvider(providerOption)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  provider === providerOption
                    ? "bg-emerald-500 text-white"
                    : "border border-border bg-secondary/70 text-foreground/70 hover:bg-accent hover:text-foreground"
                }`}
              >
                {providerOption === "gemini" ? "Gemini example" : "OpenAI example"}
              </button>
            ))}
          </div>

          <pre className={`mt-6 whitespace-pre-wrap ${codeBlockClass}`}>
            {codeExamples[activeCodeTab]}
          </pre>
        </section>

        <section className="rounded-2xl border border-border bg-card p-8">
          <h2 className="text-2xl font-serif font-normal text-foreground">Response</h2>
          <pre className={`mt-4 ${codeBlockClass}`}>{`{
  "url": "data:image/png;base64,iVBORw0KGgo...",
  "prompt": "A serene mountain landscape at sunset",
  "description": "",
  "metadata": {
    "imageSize": "2K",
    "aspectRatio": "landscape",
    "mode": "text-to-image",
    "provider": "openai",
    "model": "gpt-image-2"
  }
}`}</pre>
        </section>

        <section className="rounded-2xl border border-border bg-card p-8">
          <h2 className="text-2xl font-serif font-normal text-foreground">Playground</h2>
          <p className="mt-2 text-sm text-foreground/50">Use your platform API key to test the endpoint directly.</p>

          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Platform API key</label>
                <input
                  type="password"
                  value={platformApiKey}
                  onChange={(e) => setPlatformApiKey(e.target.value)}
                  placeholder="Paste your dashboard-generated API key"
                  className="w-full rounded-xl border border-border p-3 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Prompt</label>
              <textarea
                value={playgroundPrompt}
                onChange={(e) => setPlaygroundPrompt(e.target.value)}
                placeholder="Describe the image you want to generate..."
                className="h-24 w-full resize-none rounded-xl border border-border p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Image Size</label>
                <select
                  value={playgroundSize}
                  onChange={(e) => setPlaygroundSize(e.target.value as ImageSize)}
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Aspect Ratio</label>
                <select
                  value={playgroundAspectRatio}
                  onChange={(e) => setPlaygroundAspectRatio(e.target.value as AspectRatio)}
                  className="w-full rounded-xl border border-border bg-card p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="square">Square (1:1)</option>
                  <option value="portrait">Portrait (9:16)</option>
                  <option value="landscape">Landscape (16:9)</option>
                  <option value="wide">Wide (21:9)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !platformApiKey.trim() || !playgroundPrompt.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate image"}
            </button>
          </div>

          {playgroundResult && (
            <div className="mt-8 border-t border-border pt-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Result</h3>
                <button
                  onClick={() => setShowResponseJson((current) => !current)}
                  className="text-xs text-foreground/50 transition-colors hover:text-foreground"
                >
                  {showResponseJson ? "Hide JSON" : "Show JSON"}
                </button>
              </div>

              {playgroundResult.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">{playgroundResult.error}</p>
                  {playgroundResult.details && (
                    <p className="mt-1 text-sm text-red-600">{playgroundResult.details}</p>
                  )}
                </div>
              ) : playgroundResult.url ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-border">
                    <img
                      src={playgroundResult.url}
                      alt="Generated result"
                      className="max-h-[500px] w-full object-contain bg-muted/30"
                    />
                  </div>
                  {showResponseJson && (
                    <pre className={`text-xs ${codeBlockClass}`}>
                      {JSON.stringify(playgroundResult, null, 2)}
                    </pre>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-border bg-card px-6 py-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Logo size="xs" colorScheme="auto" />
          <p className="text-xs text-foreground/40">© 2026 Eikon. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

