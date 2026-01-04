"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useConvexAuth } from "convex/react"
import { Logo } from "@/components/logo"
import { LogoLoader } from "@/components/logo-icon"

type CodeLanguage = "curl" | "javascript" | "python"
type ApiMode = "text-to-image" | "image-editing"
type ImageSize = "1K" | "2K" | "4K"
type AspectRatio = "square" | "portrait" | "landscape" | "wide"

interface ApiResponse {
  url?: string
  prompt?: string
  metadata?: {
    imageSize: string
    aspectRatio: string
    mode: string
  }
  error?: string
  details?: string
}

export default function ApiDocsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const router = useRouter()
  
  // Code examples tab
  const [activeCodeTab, setActiveCodeTab] = useState<CodeLanguage>("curl")
  
  // Playground state
  const [playgroundMode, setPlaygroundMode] = useState<ApiMode>("text-to-image")
  const [playgroundPrompt, setPlaygroundPrompt] = useState("")
  const [playgroundSize, setPlaygroundSize] = useState<ImageSize>("2K")
  const [playgroundAspectRatio, setPlaygroundAspectRatio] = useState<AspectRatio>("square")
  const [playgroundImages, setPlaygroundImages] = useState<string[]>([])
  const [playgroundApiKey, setPlaygroundApiKey] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [playgroundResult, setPlaygroundResult] = useState<ApiResponse | null>(null)
  const [showResponseJson, setShowResponseJson] = useState(false)

  // Load API key from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem("pixelforge_api_key")
    if (savedApiKey) {
      setPlaygroundApiKey(savedApiKey)
    }
  }, [])

  // Auth redirect
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth")
    }
  }, [isLoading, isAuthenticated, router])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64 = event.target?.result as string
        setPlaygroundImages((prev) => [...prev, base64])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setPlaygroundImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGenerate = async () => {
    if (!playgroundPrompt.trim()) return

    setIsGenerating(true)
    setPlaygroundResult(null)

    try {
      const body: Record<string, unknown> = {
        prompt: playgroundPrompt,
        mode: playgroundMode,
        imageSize: playgroundSize,
        aspectRatio: playgroundAspectRatio,
      }

      if (playgroundApiKey) {
        body.apiKey = playgroundApiKey
      }

      if (playgroundMode === "image-editing" && playgroundImages.length > 0) {
        body.images = playgroundImages
      }

      const response = await fetch("/api/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()
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

  // Code examples
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"
  
  const codeExamples: Record<CodeLanguage, string> = {
    curl: `curl -X POST "${baseUrl}/api/v1/generate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "A serene mountain landscape at sunset",
    "mode": "text-to-image",
    "imageSize": "2K",
    "aspectRatio": "landscape",
    "apiKey": "YOUR_GEMINI_API_KEY"
  }'`,
    javascript: `const response = await fetch("${baseUrl}/api/v1/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "A serene mountain landscape at sunset",
    mode: "text-to-image",
    imageSize: "2K",
    aspectRatio: "landscape",
    apiKey: "YOUR_GEMINI_API_KEY",
  }),
});

const data = await response.json();
console.log(data.url); // Base64 image data URL`,
    python: `import requests

response = requests.post(
    "${baseUrl}/api/v1/generate",
    json={
        "prompt": "A serene mountain landscape at sunset",
        "mode": "text-to-image",
        "imageSize": "2K",
        "aspectRatio": "landscape",
        "apiKey": "YOUR_GEMINI_API_KEY",
    }
)

data = response.json()
print(data["url"])  # Base64 image data URL`,
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-[#f5f5f5] flex items-center justify-center select-none">
        <LogoLoader size="lg" text="Loading" />
      </div>
    )
  }

  // Redirect state
  if (!isAuthenticated) {
    return (
      <div className="h-screen bg-[#f5f5f5] flex items-center justify-center select-none">
        <LogoLoader size="lg" text="Redirecting" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-foreground transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>
          
          <h1 className="text-5xl font-serif font-normal text-foreground tracking-tight mb-4">
            API
          </h1>
          <p className="text-base text-foreground/60 max-w-lg leading-relaxed">
            Integrate Eikon&apos;s AI image generation into your applications with our REST API.
          </p>

          {/* Quick Stats */}
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="px-4 py-2 bg-gray-100 rounded-lg">
              <span className="text-xs text-foreground/50 block">Endpoint</span>
              <code className="text-sm font-mono text-foreground">/api/v1/generate</code>
            </div>
            <div className="px-4 py-2 bg-gray-100 rounded-lg">
              <span className="text-xs text-foreground/50 block">Method</span>
              <code className="text-sm font-mono text-foreground">POST</code>
            </div>
            <div className="px-4 py-2 bg-gray-100 rounded-lg">
              <span className="text-xs text-foreground/50 block">Response</span>
              <code className="text-sm font-mono text-foreground">JSON</code>
            </div>
          </div>
        </div>
      </header>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-20">
        {/* Authentication Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">01</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Authentication</h2>
          </div>
          
          <div className="bg-white rounded-2xl border border-border p-8">
            <p className="text-foreground/70 leading-relaxed mb-4">
              The API uses Google Gemini for image generation. You&apos;ll need a Gemini API key to make requests.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-emerald-800 font-medium">Get your free API key</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    Visit{" "}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-emerald-900"
                    >
                      Google AI Studio
                    </a>
                    {" "}to create your free Gemini API key.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-foreground/50">
              Pass your API key in the request body as <code className="bg-gray-100 px-1.5 py-0.5 rounded text-foreground">apiKey</code>. 
              If omitted, the server&apos;s default key will be used (subject to rate limits).
            </p>
          </div>
        </section>

        {/* Endpoint Reference Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">02</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Endpoint Reference</h2>
          </div>
          
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            {/* Endpoint Header */}
            <div className="px-8 py-4 bg-gray-50 border-b border-border flex items-center gap-3">
              <span className="px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded">POST</span>
              <code className="text-sm font-mono text-foreground">/api/v1/generate</code>
            </div>
            
            {/* Parameters */}
            <div className="p-8">
              <h3 className="text-sm font-semibold text-foreground mb-4">Request Body Parameters</h3>
              <div className="space-y-4">
                {/* prompt */}
                <div className="border-b border-border pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-foreground">prompt</code>
                    <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">required</span>
                    <span className="text-xs text-foreground/50">string</span>
                  </div>
                  <p className="text-sm text-foreground/60">Text description of the image to generate or the editing instructions.</p>
                </div>

                {/* mode */}
                <div className="border-b border-border pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-foreground">mode</code>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">optional</span>
                    <span className="text-xs text-foreground/50">string</span>
                  </div>
                  <p className="text-sm text-foreground/60 mb-2">Generation mode. Default: <code className="bg-gray-100 px-1 rounded">text-to-image</code></p>
                  <div className="flex flex-wrap gap-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;text-to-image&quot;</code>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;image-editing&quot;</code>
                  </div>
                </div>

                {/* imageSize */}
                <div className="border-b border-border pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-foreground">imageSize</code>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">optional</span>
                    <span className="text-xs text-foreground/50">string</span>
                  </div>
                  <p className="text-sm text-foreground/60 mb-2">Output image resolution. Default: <code className="bg-gray-100 px-1 rounded">2K</code></p>
                  <div className="flex flex-wrap gap-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;1K&quot;</code>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;2K&quot;</code>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;4K&quot;</code>
                  </div>
                </div>

                {/* aspectRatio */}
                <div className="border-b border-border pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-foreground">aspectRatio</code>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">optional</span>
                    <span className="text-xs text-foreground/50">string</span>
                  </div>
                  <p className="text-sm text-foreground/60 mb-2">Output aspect ratio. Default: <code className="bg-gray-100 px-1 rounded">square</code></p>
                  <div className="flex flex-wrap gap-2">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;square&quot;</code>
                    <span className="text-xs text-foreground/40">1:1</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;portrait&quot;</code>
                    <span className="text-xs text-foreground/40">9:16</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;landscape&quot;</code>
                    <span className="text-xs text-foreground/40">16:9</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">&quot;wide&quot;</code>
                    <span className="text-xs text-foreground/40">21:9</span>
                  </div>
                </div>

                {/* images */}
                <div className="border-b border-border pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-foreground">images</code>
                    <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">conditional</span>
                    <span className="text-xs text-foreground/50">string[]</span>
                  </div>
                  <p className="text-sm text-foreground/60">Array of base64-encoded images. Required when <code className="bg-gray-100 px-1 rounded">mode</code> is <code className="bg-gray-100 px-1 rounded">image-editing</code>.</p>
                </div>

                {/* apiKey */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono text-foreground">apiKey</code>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">optional</span>
                    <span className="text-xs text-foreground/50">string</span>
                  </div>
                  <p className="text-sm text-foreground/60">Your Gemini API key. If omitted, uses the server&apos;s default key.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Response Format Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">03</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Response Format</h2>
          </div>
          
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-8 py-4 bg-gray-50 border-b border-border">
              <span className="text-sm font-medium text-foreground">Success Response (200)</span>
            </div>
            <div className="p-8">
              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-sm font-mono">
{`{
  "url": "data:image/png;base64,iVBORw0KGgo...",
  "prompt": "A serene mountain landscape at sunset",
  "description": "",
  "metadata": {
    "imageSize": "2K",
    "aspectRatio": "landscape",
    "mode": "text-to-image"
  }
}`}
              </pre>
              
              <h4 className="text-sm font-semibold text-foreground mt-6 mb-3">Response Fields</h4>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <code className="font-mono text-foreground bg-gray-100 px-1.5 py-0.5 rounded">url</code>
                  <span className="text-foreground/60">Base64-encoded data URL of the generated image</span>
                </div>
                <div className="flex gap-2">
                  <code className="font-mono text-foreground bg-gray-100 px-1.5 py-0.5 rounded">prompt</code>
                  <span className="text-foreground/60">The prompt used for generation</span>
                </div>
                <div className="flex gap-2">
                  <code className="font-mono text-foreground bg-gray-100 px-1.5 py-0.5 rounded">metadata</code>
                  <span className="text-foreground/60">Generation parameters used</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Code Examples Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">04</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Code Examples</h2>
          </div>
          
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {(["curl", "javascript", "python"] as CodeLanguage[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveCodeTab(lang)}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeCodeTab === lang
                      ? "bg-gray-50 text-foreground border-b-2 border-emerald-500"
                      : "text-foreground/60 hover:text-foreground hover:bg-gray-50"
                  }`}
                >
                  {lang === "curl" ? "cURL" : lang === "javascript" ? "JavaScript" : "Python"}
                </button>
              ))}
            </div>
            
            {/* Code Block */}
            <div className="p-6">
              <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                {codeExamples[activeCodeTab]}
              </pre>
            </div>
          </div>
        </section>

        {/* Error Handling Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">05</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Error Handling</h2>
          </div>
          
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {/* 400 */}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded">400</span>
                  <span className="text-sm font-medium text-foreground">Bad Request</span>
                </div>
                <p className="text-sm text-foreground/60 mb-3">Missing or invalid parameters</p>
                <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`{ "error": "Missing required field", "details": "'prompt' is required" }`}
                </pre>
              </div>
              
              {/* 401 */}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">401</span>
                  <span className="text-sm font-medium text-foreground">Unauthorized</span>
                </div>
                <p className="text-sm text-foreground/60 mb-3">No API key provided or configured</p>
                <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`{ "error": "No API key configured", "details": "Please provide an apiKey..." }`}
                </pre>
              </div>
              
              {/* 500 */}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded">500</span>
                  <span className="text-sm font-medium text-foreground">Server Error</span>
                </div>
                <p className="text-sm text-foreground/60 mb-3">Image generation failed</p>
                <pre className="bg-gray-100 rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`{ "error": "Failed to generate image", "details": "..." }`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Playground Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">06</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Playground</h2>
            <p className="text-sm text-foreground/50 mt-2">Test the API directly from your browser</p>
          </div>
          
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="p-8 space-y-6">
              {/* Mode Selector */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPlaygroundMode("text-to-image")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      playgroundMode === "text-to-image"
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-100 text-foreground/70 hover:bg-gray-200"
                    }`}
                  >
                    Text to Image
                  </button>
                  <button
                    onClick={() => setPlaygroundMode("image-editing")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      playgroundMode === "image-editing"
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-100 text-foreground/70 hover:bg-gray-200"
                    }`}
                  >
                    Image Editing
                  </button>
                </div>
              </div>

              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Prompt</label>
                <textarea
                  value={playgroundPrompt}
                  onChange={(e) => setPlaygroundPrompt(e.target.value)}
                  placeholder={playgroundMode === "text-to-image" 
                    ? "Describe the image you want to generate..."
                    : "Describe how you want to edit the image..."
                  }
                  className="w-full h-24 p-3 border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Image Upload (for editing mode) */}
              {playgroundMode === "image-editing" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Images</label>
                  <div className="space-y-3">
                    {playgroundImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {playgroundImages.map((img, i) => (
                          <div key={i} className="relative group">
                            <img
                              src={img}
                              alt={`Upload ${i + 1}`}
                              className="w-20 h-20 object-cover rounded-lg border border-border"
                            />
                            <button
                              onClick={() => removeImage(i)}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-emerald-500 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <span className="text-sm text-foreground/50">Click to upload images</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Size and Aspect Ratio */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Image Size</label>
                  <select
                    value={playgroundSize}
                    onChange={(e) => setPlaygroundSize(e.target.value as ImageSize)}
                    className="w-full p-3 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Aspect Ratio</label>
                  <select
                    value={playgroundAspectRatio}
                    onChange={(e) => setPlaygroundAspectRatio(e.target.value as AspectRatio)}
                    className="w-full p-3 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="square">Square (1:1)</option>
                    <option value="portrait">Portrait (9:16)</option>
                    <option value="landscape">Landscape (16:9)</option>
                    <option value="wide">Wide (21:9)</option>
                  </select>
                </div>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  API Key <span className="text-foreground/40 font-normal">(optional)</span>
                </label>
                <input
                  type="password"
                  value={playgroundApiKey}
                  onChange={(e) => setPlaygroundApiKey(e.target.value)}
                  placeholder="Your Gemini API key (uses server default if empty)"
                  className="w-full p-3 border border-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !playgroundPrompt.trim() || (playgroundMode === "image-editing" && playgroundImages.length === 0)}
                className="w-full py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Image
                  </>
                )}
              </button>
            </div>

            {/* Result Display */}
            {playgroundResult && (
              <div className="border-t border-border p-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Result</h3>
                  <button
                    onClick={() => setShowResponseJson(!showResponseJson)}
                    className="text-xs text-foreground/50 hover:text-foreground transition-colors"
                  >
                    {showResponseJson ? "Hide JSON" : "Show JSON"}
                  </button>
                </div>

                {playgroundResult.error ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm text-red-800 font-medium">{playgroundResult.error}</p>
                    {playgroundResult.details && (
                      <p className="text-sm text-red-600 mt-1">{playgroundResult.details}</p>
                    )}
                  </div>
                ) : playgroundResult.url ? (
                  <div className="space-y-4">
                    <div className="rounded-xl overflow-hidden border border-border">
                      <img
                        src={playgroundResult.url}
                        alt="Generated"
                        className="w-full max-h-[500px] object-contain bg-gray-50"
                      />
                    </div>
                    {showResponseJson && (
                      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-xs font-mono">
                        {JSON.stringify(playgroundResult, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 bg-white">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Logo size="xs" colorScheme="dark" />
          <p className="text-xs text-foreground/40">
            © 2026 Eikon. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

