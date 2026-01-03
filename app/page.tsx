"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";

export default function LandingPage() {
  const { isAuthenticated } = useConvexAuth();

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f5f5f5] border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <div className="w-10 h-10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/studio"
                className="text-sm text-foreground/70 hover:text-foreground transition-colors"
              >
                Studio
              </Link>
              <Link
                href="/api/v1"
                className="text-sm text-foreground/70 hover:text-foreground transition-colors"
              >
                API
              </Link>
              <Link
                href="#features"
                className="text-sm text-foreground/70 hover:text-foreground transition-colors"
              >
                Features
              </Link>
              <Link
                href="#docs"
                className="text-sm text-foreground/70 hover:text-foreground transition-colors"
              >
                Docs
              </Link>
            </nav>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-full text-sm hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>8K</span>
            </a>
            <Link
              href={isAuthenticated ? "/studio" : "/auth"}
              className="px-5 py-2 bg-[#4ECDC4] text-white font-medium rounded-lg text-sm hover:bg-[#45b8b0] transition-all"
            >
              {isAuthenticated ? "Open Studio" : "Get Started"}
            </Link>
          </div>
        </div>
      </header>

      {/* Striped border - top */}
      <div 
        className="fixed top-[72px] left-0 right-0 h-3 z-40"
        style={{
          background: `repeating-linear-gradient(
            -45deg,
            #e5e5e5,
            #e5e5e5 4px,
            #f5f5f5 4px,
            #f5f5f5 8px
          )`
        }}
      />

      {/* Hero Section */}
      <main className="pt-40 pb-20 px-6 relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Announcement badge */}
          <div className="inline-flex items-center gap-2 mb-8">
            <span className="w-2 h-2 bg-foreground rounded-full" />
            <span className="text-xs uppercase tracking-widest text-foreground/60">
              New Feature Available
            </span>
            <span className="text-xs text-[#4ECDC4] font-medium uppercase tracking-wider">
              — Read More
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.1] mb-6 tracking-tight text-foreground">
            The image studio
            <br />
            for creative AI
          </h1>

          {/* Subheadline */}
          <p className="text-base text-foreground/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            PixelForge combines, transforms, and generates images with AI — built
            for designers, creators, and developers who demand precision.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4">
            <Link
              href={isAuthenticated ? "/studio" : "/auth"}
              className="px-8 py-3.5 bg-[#4ECDC4] text-white font-medium rounded-lg text-sm hover:bg-[#45b8b0] transition-all"
            >
              Launch Studio
            </Link>
            <Link
              href="#docs"
              className="px-8 py-3.5 border border-border bg-white text-foreground font-medium rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Read Docs
            </Link>
          </div>
        </div>

        {/* Feature showcase */}
        <div className="max-w-5xl mx-auto mt-20">
          <div className="relative rounded-2xl overflow-hidden">
            {/* Gradient background with particle effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a2a3a] via-[#0d3a4a] to-[#1a4a5a]">
              {/* Particle/noise effect overlay */}
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 1px 1px, rgba(78, 205, 196, 0.3) 1px, transparent 0),
                    radial-gradient(circle at 3px 3px, rgba(255, 255, 255, 0.1) 1px, transparent 0)
                  `,
                  backgroundSize: "20px 20px, 30px 30px",
                }}
              />
              {/* Glow effects */}
              <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#4ECDC4]/20 rounded-full blur-[100px]" />
              <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-[#4ECDC4]/15 rounded-full blur-[100px]" />
            </div>

            {/* Terminal windows */}
            <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-6">
              {/* Left terminal - Chat style */}
              <div className="flex-1 bg-black/90 backdrop-blur rounded-xl overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="p-5 space-y-4 font-mono text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#4ECDC4] flex items-center justify-center text-xs text-black font-bold shrink-0">
                      U
                    </div>
                    <p className="text-white/90 leading-relaxed">
                      Combine product photos with lifestyle backgrounds.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs shrink-0">
                      <svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      Found 8 matches. Best result: Modern kitchen scene —{" "}
                      <span className="text-white font-medium">
                        natural lighting, marble countertop
                      </span>
                      .
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#4ECDC4] flex items-center justify-center text-xs text-black font-bold shrink-0">
                      U
                    </div>
                    <p className="text-white/90 leading-relaxed">
                      Generate variations with warm tones.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs shrink-0">
                      <svg
                        className="w-3 h-3 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                    <p className="text-white/70 leading-relaxed">
                      Done. 4 variations created and saved.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right terminal - Timeline style */}
              <div className="flex-1 bg-black/90 backdrop-blur rounded-xl overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="p-5 space-y-4 font-mono text-sm">
                  <div className="flex items-center justify-between text-white/60">
                    <span className="text-white/90">09:10</span>
                    <span className="flex-1 mx-4 border-t border-dashed border-white/30" />
                    <span className="text-white/90">09:35</span>
                  </div>
                  <div className="flex items-center justify-between text-white/50 text-xs">
                    <span>Image Upload</span>
                    <span>AI Processing</span>
                  </div>

                  <div className="flex items-center justify-between text-white/60 mt-4">
                    <span className="text-white/90">10:00</span>
                    <span className="flex-1 mx-4 border-t border-dashed border-white/30" />
                    <span className="text-white/90">10:25</span>
                  </div>
                  <div className="flex items-center justify-between text-white/50 text-xs">
                    <span>Style Transfer</span>
                    <span>Export Ready</span>
                  </div>

                  <div className="flex items-center justify-between text-white/60 mt-4">
                    <span className="text-white/90">12:05</span>
                    <span className="flex-1 mx-4 border-t border-dashed border-white/30" />
                    <span className="text-white/90">12:45</span>
                  </div>
                  <div className="flex items-center justify-between text-white/50 text-xs">
                    <span>Batch Process</span>
                    <span>Cloud Archive</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Striped border - middle */}
        <div 
          className="max-w-5xl mx-auto mt-20 h-3"
          style={{
            background: `repeating-linear-gradient(
              -45deg,
              #e5e5e5,
              #e5e5e5 4px,
              #f5f5f5 4px,
              #f5f5f5 8px
            )`
          }}
        />

        {/* Stats section */}
        <section className="max-w-5xl mx-auto mt-0">
          <div className="grid md:grid-cols-3 divide-x divide-border border-t border-b border-border bg-white">
            <div className="p-8 text-center md:text-left">
              <div className="text-4xl font-semibold tracking-tight mb-2">&lt;1s</div>
              <div className="text-sm text-foreground/50">From Upload to Result</div>
            </div>
            <div className="p-8 text-center md:text-left">
              <div className="text-4xl font-semibold tracking-tight mb-2">50,000+</div>
              <div className="text-sm text-foreground/50">Images Processed</div>
            </div>
            <div className="p-8 text-center md:text-left">
              <div className="text-4xl font-semibold tracking-tight mb-2">99.9%</div>
              <div className="text-sm text-foreground/50">Uptime Guaranteed</div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section id="features" className="max-w-5xl mx-auto mt-24">
          <h2 className="text-3xl font-semibold text-center mb-16 tracking-tight">
            Built for precision
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-[#f5f5f5] rounded-xl flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-foreground/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Image Combining</h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Seamlessly merge multiple images with AI-powered blending and
                intelligent edge detection.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-[#f5f5f5] rounded-xl flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-foreground/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">AI Generation</h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Generate stunning variations and transformations powered by
                state-of-the-art AI models.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
              <div className="w-12 h-12 bg-[#f5f5f5] rounded-xl flex items-center justify-center mb-4">
                <svg
                  className="w-6 h-6 text-foreground/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Developer API</h3>
              <p className="text-sm text-foreground/60 leading-relaxed">
                Integrate image processing into your workflow with our
                comprehensive REST API.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <span className="text-sm font-semibold">PixelForge</span>
          </div>
          <p className="text-xs text-foreground/40">
            © 2026 PixelForge. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
