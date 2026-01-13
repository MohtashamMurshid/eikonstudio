import Link from "next/link";

export function DetailedFeatures() {
  return (
    <section className="max-w-5xl mx-auto mt-24">
      <h2 className="text-3xl font-semibold text-center mb-6 tracking-tight">
        Explore the possibilities
      </h2>
      <p className="text-base text-foreground/60 text-center max-w-2xl mx-auto mb-16">
        Discover how Eikon transforms your creative workflow with powerful AI-driven tools.
      </p>

      {/* Feature 1: AI Image Generation - Left aligned */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
        {/* Visual */}
        <div className="relative">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            {/* Prompt input mockup */}
            <div className="mb-4">
              <div className="text-xs text-foreground/50 uppercase tracking-wider mb-2">Prompt</div>
              <div className="bg-secondary/30 rounded-xl p-3 text-sm text-foreground/70">
                A serene Japanese garden with cherry blossoms <span className="text-emerald-500">/watercolor</span>
              </div>
            </div>
            {/* Art style chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 text-xs rounded-lg">Watercolor</span>
              <span className="px-2 py-1 bg-secondary text-foreground/60 text-xs rounded-lg">Renaissance</span>
              <span className="px-2 py-1 bg-secondary text-foreground/60 text-xs rounded-lg">Anime</span>
              <span className="px-2 py-1 bg-secondary text-foreground/60 text-xs rounded-lg">+14 more</span>
            </div>
            {/* Result mockup */}
            <div className="aspect-video bg-gradient-to-br from-pink-100 via-rose-50 to-amber-100 dark:from-pink-900/30 dark:via-rose-900/20 dark:to-amber-900/30 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <svg className="w-8 h-8 text-rose-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span className="text-xs text-rose-500 font-medium">Generated</span>
              </div>
            </div>
          </div>
          {/* Decorative element */}
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
        </div>

        {/* Content */}
        <div>
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </span>
            <span className="text-xs uppercase tracking-wider text-emerald-600 font-medium">AI Image Generation</span>
          </div>
          <h3 className="text-2xl font-semibold mb-4 tracking-tight">
            Create stunning images with Gemini 3 Pro
          </h3>
          <p className="text-foreground/60 mb-6 leading-relaxed">
            Generate images from text or transform existing ones. Use skill presets like <code className="bg-secondary px-1.5 py-0.5 rounded text-sm">/technical</code> or <code className="bg-secondary px-1.5 py-0.5 rounded text-sm">/anime</code> for instant style application.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">17 art styles: Fresco, Renaissance, Watercolor, Digital Art, and more</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">13 skill presets: /technical, /anime, /cinematic, /portrait, and more</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Multiple resolutions (1K, 2K, 4K) and aspect ratios</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Edit up to 4 images together with AI-powered combining</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Feature 2: Video Generation - Right aligned */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
        {/* Content */}
        <div className="md:order-2">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
            <span className="text-xs uppercase tracking-wider text-violet-600 font-medium">Video Generation</span>
          </div>
          <h3 className="text-2xl font-semibold mb-4 tracking-tight">
            Generate videos with Google Veo 3.1
          </h3>
          <p className="text-foreground/60 mb-6 leading-relaxed">
            Create stunning videos from text prompts, animate still images, or generate smooth transitions between frames. 
            Powered by Google&apos;s latest video generation model.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Text-to-video: Describe your scene, get a video</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Image-to-video: Animate any still image with motion</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Frame interpolation: Smooth transitions between two images</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">720p or 1080p resolution, 16:9 or 9:16 aspect ratio</span>
            </li>
          </ul>
          <Link
            href="/studio/create-video"
            className="inline-flex items-center gap-2 mt-6 text-sm text-violet-600 font-medium hover:text-violet-700 transition-colors"
          >
            Try Video Generation
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Visual */}
        <div className="relative md:order-1">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            {/* Video generation modes */}
            <div className="text-xs text-foreground/50 uppercase tracking-wider mb-4">Generation Modes</div>
            <div className="space-y-3">
              {/* Text to Video */}
              <div className="flex items-center gap-3 p-3 bg-violet-500/5 rounded-xl border border-violet-500/20">
                <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">Text to Video</div>
                  <div className="text-xs text-foreground/50 truncate">Describe a scene in words</div>
                </div>
              </div>
              {/* Image to Video */}
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
                <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground/80">Image to Video</div>
                  <div className="text-xs text-foreground/50 truncate">Animate a still image</div>
                </div>
              </div>
              {/* Frame to Frame */}
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
                <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground/80">Frame to Frame</div>
                  <div className="text-xs text-foreground/50 truncate">Interpolate between two images</div>
                </div>
              </div>
            </div>
          </div>
          {/* Decorative element */}
          <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl" />
        </div>
      </div>

      {/* Feature 3: Developer API - Left aligned */}
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {/* Visual */}
        <div className="relative">
          <div className="bg-[#1e1e1e] rounded-2xl overflow-hidden shadow-xl">
            {/* Code editor header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span className="ml-4 text-xs text-white/40 font-mono">generate.ts</span>
            </div>
            {/* Code content */}
            <div className="p-5 font-mono text-sm overflow-x-auto">
              <div className="text-white/50">
                <span className="text-violet-400">const</span> <span className="text-blue-300">response</span> <span className="text-white/50">=</span> <span className="text-violet-400">await</span> <span className="text-yellow-300">fetch</span><span className="text-white/70">(</span>
              </div>
              <div className="pl-4 text-emerald-400">{`'/api/v1/generate'`}<span className="text-white/70">,</span></div>
              <div className="pl-4 text-white/70">{"{"}</div>
              <div className="pl-8"><span className="text-blue-300">method</span><span className="text-white/70">:</span> <span className="text-emerald-400">{`'POST'`}</span><span className="text-white/70">,</span></div>
              <div className="pl-8"><span className="text-blue-300">body</span><span className="text-white/70">:</span> <span className="text-yellow-300">JSON</span><span className="text-white/70">.</span><span className="text-yellow-300">stringify</span><span className="text-white/70">({"{"}</span></div>
              <div className="pl-12"><span className="text-blue-300">prompt</span><span className="text-white/70">:</span> <span className="text-emerald-400">{`'A mountain landscape'`}</span><span className="text-white/70">,</span></div>
              <div className="pl-12"><span className="text-blue-300">imageSize</span><span className="text-white/70">:</span> <span className="text-emerald-400">{`'2K'`}</span><span className="text-white/70">,</span></div>
              <div className="pl-12"><span className="text-blue-300">aspectRatio</span><span className="text-white/70">:</span> <span className="text-emerald-400">{`'landscape'`}</span></div>
              <div className="pl-8 text-white/70">{"})"}</div>
              <div className="pl-4 text-white/70">{"}"}</div>
              <div className="text-white/70">);</div>
              <div className="mt-2 text-white/40">{"// Returns { url, prompt, metadata }"}</div>
            </div>
          </div>
          {/* Decorative element */}
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
        </div>

        {/* Content */}
        <div>
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </span>
            <span className="text-xs uppercase tracking-wider text-blue-600 font-medium">Developer API</span>
          </div>
          <h3 className="text-2xl font-semibold mb-4 tracking-tight">
            Integrate with our REST API
          </h3>
          <p className="text-foreground/60 mb-6 leading-relaxed">
            Build AI image generation into your applications with our simple REST API. 
            Includes an interactive playground to test requests before coding.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Single endpoint: <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">/api/v1/generate</code></span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Interactive API playground with live testing</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Code examples for curl, JavaScript, and Python</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">JSON responses with base64-encoded images</span>
            </li>
          </ul>
          <Link
            href="/api-docs"
            className="inline-flex items-center gap-2 mt-6 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
          >
            View API Documentation
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
