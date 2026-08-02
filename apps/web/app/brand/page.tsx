"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Logo, LogoIconOnly, LogoStacked } from "@/components/logo"
import { LogoIcon, LogoLoader, LogoLoaderWithProgress, LogoSkeleton } from "@/components/logo-icon"

export default function BrandPage() {
  // Progress bar demo state
  const [progress, setProgress] = useState(0)
  const [isProgressRunning, setIsProgressRunning] = useState(true)

  // Animate progress bar
  useEffect(() => {
    if (!isProgressRunning) return
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 0
        }
        return prev + 2
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isProgressRunning])

  // SVG content for download
  const logoSvgContent = `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 3L28 16L16 29L4 16L16 3Z" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <circle cx="16" cy="16" r="5" stroke="currentColor" stroke-width="2.5" fill="none"/>
  <circle cx="16" cy="16" r="2" fill="currentColor"/>
</svg>`

  const handleDownloadSvg = () => {
    const blob = new Blob([logoSvgContent], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "eikon-logo.svg"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
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
            Brand
          </h1>
          <p className="text-base text-foreground/60 max-w-lg leading-relaxed">
            Official assets for Eikon. Use these consistently to represent our brand across all touchpoints.
          </p>
        </div>
      </header>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16 space-y-20">
        {/* Primary Logo Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">01</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Primary Logo</h2>
          </div>
          
          <div className="space-y-4">
            {/* Light background */}
            <div className="bg-card rounded-2xl border border-border p-16 flex items-center justify-center">
              <Logo size="lg" colorScheme="dark" />
            </div>
            
            {/* Dark background */}
            <div className="bg-foreground rounded-2xl p-16 flex items-center justify-center">
              <Logo size="lg" colorScheme="light" />
            </div>
          </div>
        </section>

        {/* With Tagline Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">02</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">With tagline</h2>
          </div>
          
          <div className="space-y-4">
            {/* Light background */}
            <div className="bg-card rounded-2xl border border-border p-16 flex items-center justify-center">
              <Logo size="lg" colorScheme="dark" tagline="The image studio for creative AI" />
            </div>
            
            {/* Dark background */}
            <div className="bg-foreground rounded-2xl p-16 flex items-center justify-center">
              <Logo size="lg" colorScheme="light" tagline="The image studio for creative AI" />
            </div>
          </div>
        </section>

        {/* Logo Variants Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">03</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Logo variants</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            {/* Icon only */}
            <div className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center justify-center">
              <LogoIconOnly size="lg" colorScheme="dark" />
              <span className="text-xs text-foreground/40 mt-4">Icon only</span>
            </div>
            
            {/* Stacked */}
            <div className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center justify-center">
              <LogoStacked size="md" colorScheme="dark" />
              <span className="text-xs text-foreground/40 mt-4">Stacked</span>
            </div>
            
            {/* Horizontal (default) */}
            <div className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center justify-center">
              <Logo size="md" colorScheme="dark" />
              <span className="text-xs text-foreground/40 mt-4">Horizontal</span>
            </div>
          </div>
        </section>

        {/* Icon Sizes Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">04</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Icon sizes</h2>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-12">
            <div className="flex items-end justify-center gap-8">
              <div className="flex flex-col items-center">
                <div className="size-6 bg-foreground rounded-md flex items-center justify-center">
                  <LogoIcon className="size-3.5 text-background" />
                </div>
                <span className="text-xs text-foreground/40 mt-3 font-mono">xs</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="size-8 bg-foreground rounded-lg flex items-center justify-center">
                  <LogoIcon className="size-5 text-background" />
                </div>
                <span className="text-xs text-foreground/40 mt-3 font-mono">sm</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="size-10 bg-foreground rounded-lg flex items-center justify-center">
                  <LogoIcon className="size-6 text-background" />
                </div>
                <span className="text-xs text-foreground/40 mt-3 font-mono">md</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="size-12 bg-foreground rounded-xl flex items-center justify-center">
                  <LogoIcon className="size-7 text-background" />
                </div>
                <span className="text-xs text-foreground/40 mt-3 font-mono">lg</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="size-16 bg-foreground rounded-xl flex items-center justify-center">
                  <LogoIcon className="size-9 text-background" />
                </div>
                <span className="text-xs text-foreground/40 mt-3 font-mono">xl</span>
              </div>
            </div>
          </div>
        </section>

        {/* Loading States Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">05</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Loading states</h2>
          </div>
          
          {/* Pulse loaders */}
          <p className="text-sm text-foreground/60 mb-4">Indeterminate loaders</p>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {/* Small loader */}
            <div className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center justify-center min-h-[200px]">
              <LogoLoader size="sm" />
              <span className="text-xs text-foreground/40 mt-6">Small</span>
            </div>
            
            {/* Medium loader */}
            <div className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center justify-center min-h-[200px]">
              <LogoLoader size="md" />
              <span className="text-xs text-foreground/40 mt-6">Medium</span>
            </div>
            
            {/* Large loader with text */}
            <div className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center justify-center min-h-[200px]">
              <LogoLoader size="lg" text="Loading" />
            </div>
          </div>

          {/* Progress bar loaders */}
          <p className="text-sm text-foreground/60 mb-4">Progress bar loaders</p>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* Animated progress */}
            <div 
              className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center justify-center min-h-[240px] cursor-pointer hover:bg-accent transition-colors"
              onClick={() => setIsProgressRunning(!isProgressRunning)}
            >
              <LogoLoaderWithProgress 
                size="lg" 
                progress={progress} 
                text="Processing images" 
              />
              <span className="text-xs text-foreground/40 mt-4">
                {isProgressRunning ? "Click to pause" : "Click to resume"}
              </span>
            </div>
            
            {/* Static progress examples */}
            <div className="bg-card rounded-2xl border border-border p-8 flex flex-col justify-center gap-6">
              <LogoLoaderWithProgress size="sm" progress={25} text="Starting" />
              <LogoLoaderWithProgress size="sm" progress={50} text="Halfway" />
              <LogoLoaderWithProgress size="sm" progress={75} text="Almost done" />
              <LogoLoaderWithProgress size="sm" progress={100} text="Complete" />
            </div>
          </div>

          {/* Skeleton loader */}
          <p className="text-sm text-foreground/60 mb-4">Skeleton loader</p>
          <div className="bg-card rounded-2xl border border-border p-8">
            <div className="flex items-center gap-8">
              <LogoSkeleton />
              <div className="flex-1">
                <p className="text-sm text-foreground/60">
                  Use skeleton loaders for inline or content placeholder states.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Color Palette Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">06</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Color palette</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            {/* Foreground */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="h-24 bg-foreground" />
              <div className="p-4">
                <p className="font-medium text-foreground">Foreground</p>
                <p className="text-xs text-foreground/50 font-mono mt-1">#0a0a0a</p>
              </div>
            </div>
            
            {/* Emerald */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="h-24 bg-emerald-500" />
              <div className="p-4">
                <p className="font-medium text-foreground">Emerald</p>
                <p className="text-xs text-foreground/50 font-mono mt-1">#10b981</p>
              </div>
            </div>
            
            {/* Background */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="h-24 bg-background border-b border-border" />
              <div className="p-4">
                <p className="font-medium text-foreground">Background</p>
                <p className="text-xs text-foreground/50 font-mono mt-1">#f5f5f5</p>
              </div>
            </div>
          </div>
        </section>

        {/* Typography Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">07</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Typography</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* Primary font */}
            <div className="bg-card rounded-2xl border border-border p-8">
              <span className="text-5xl font-sans font-semibold text-foreground">Aa</span>
              <div className="mt-4">
                <p className="font-medium text-foreground">Inter</p>
                <p className="text-xs text-foreground/50 mt-1">Primary typeface for UI and body text</p>
              </div>
            </div>
            
            {/* Mono font */}
            <div className="bg-card rounded-2xl border border-border p-8">
              <span className="text-5xl font-mono font-semibold text-foreground">Aa</span>
              <div className="mt-4">
                <p className="font-medium text-foreground">JetBrains Mono</p>
                <p className="text-xs text-foreground/50 mt-1">Code and technical content</p>
              </div>
            </div>
          </div>
        </section>

        {/* Download Assets Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">08</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Download assets</h2>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-8">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownloadSvg}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Logo SVG
              </button>
              
              <a
                href="/logo.png"
                download="eikon-logo.png"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-card border border-border text-foreground rounded-lg text-sm font-medium hover:bg-accent transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Logo PNG
              </a>
            </div>
            
            <p className="text-xs text-foreground/50 mt-4">
              By downloading these assets, you agree to use them in accordance with our brand guidelines.
            </p>
          </div>
        </section>

        {/* Usage Guidelines Section */}
        <section>
          <div className="mb-6">
            <span className="text-xs text-foreground/40 font-mono tracking-wider">09</span>
            <h2 className="text-2xl font-serif font-normal text-foreground mt-1">Usage guidelines</h2>
          </div>
          
          <div className="bg-card rounded-2xl border border-border p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Do
                </h3>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li>• Use the logo with adequate clear space</li>
                  <li>• Maintain the original aspect ratio</li>
                  <li>• Use approved color variations</li>
                  <li>• Ensure sufficient contrast with backgrounds</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Don&apos;t
                </h3>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li>• Stretch or distort the logo</li>
                  <li>• Change the logo colors arbitrarily</li>
                  <li>• Add effects like shadows or gradients</li>
                  <li>• Use the logo on busy backgrounds</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 bg-card">
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

