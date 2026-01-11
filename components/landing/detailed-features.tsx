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

      {/* Feature 1: Image Combining - Left aligned */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
        {/* Visual */}
        <div className="relative">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            {/* Before/After mockup */}
            <div className="flex gap-4">
              <div className="flex-1 space-y-3">
                <div className="text-xs text-foreground/50 uppercase tracking-wider">Input</div>
                <div className="aspect-square bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl flex items-center justify-center">
                  <div className="w-16 h-20 bg-card rounded-lg shadow-md" />
                </div>
              </div>
              <div className="flex items-center">
                <svg className="w-6 h-6 text-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-4-4m4 4l4-4" />
                </svg>
              </div>
              <div className="flex-1 space-y-3">
                <div className="text-xs text-foreground/50 uppercase tracking-wider">Background</div>
                <div className="aspect-square bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-xl" />
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-border">
              <div className="text-xs text-foreground/50 uppercase tracking-wider mb-3">Result</div>
              <div className="aspect-video bg-gradient-to-br from-emerald-100 via-amber-50 to-teal-100 dark:from-emerald-900/30 dark:via-amber-900/20 dark:to-teal-900/30 rounded-xl flex items-center justify-center">
                <div className="w-20 h-24 bg-card rounded-lg shadow-lg" />
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <span className="text-xs uppercase tracking-wider text-emerald-600 font-medium">Image Combining</span>
          </div>
          <h3 className="text-2xl font-semibold mb-4 tracking-tight">
            Merge images with pixel-perfect precision
          </h3>
          <p className="text-foreground/60 mb-6 leading-relaxed">
            Upload your product shots and background scenes, and let our AI seamlessly blend them together. 
            Perfect for e-commerce, marketing materials, and creative composites.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Intelligent edge detection and masking</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Automatic lighting and shadow matching</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Support for transparent PNG and layered files</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Feature 2: AI Generation - Right aligned */}
      <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
        {/* Content */}
        <div className="md:order-2">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <span className="text-xs uppercase tracking-wider text-violet-600 font-medium">AI Generation</span>
          </div>
          <h3 className="text-2xl font-semibold mb-4 tracking-tight">
            Create endless variations instantly
          </h3>
          <p className="text-foreground/60 mb-6 leading-relaxed">
            Transform a single image into multiple style variations. From photorealistic to artistic, 
            generate the perfect version for any use case.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">12+ artistic styles including watercolor, oil paint, and sketch</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Custom prompt support for precise control</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Batch processing for multiple images at once</span>
            </li>
          </ul>
        </div>

        {/* Visual */}
        <div className="relative md:order-1">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            {/* Style variations grid */}
            <div className="text-xs text-foreground/50 uppercase tracking-wider mb-4">Style Variations</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="aspect-square bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30 rounded-xl flex items-center justify-center">
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Watercolor</span>
              </div>
              <div className="aspect-square bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-xl flex items-center justify-center">
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Oil Paint</span>
              </div>
              <div className="aspect-square bg-gradient-to-br from-slate-100 to-gray-200 dark:from-slate-800 dark:to-gray-700 rounded-xl flex items-center justify-center">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Sketch</span>
              </div>
              <div className="aspect-square bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 rounded-xl flex items-center justify-center">
                <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">Digital Art</span>
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
              <span className="ml-4 text-xs text-white/40 font-mono">api-example.ts</span>
            </div>
            {/* Code content */}
            <div className="p-5 font-mono text-sm overflow-x-auto">
              <div className="text-white/50">
                <span className="text-violet-400">const</span> <span className="text-blue-300">response</span> <span className="text-white/50">=</span> <span className="text-violet-400">await</span> <span className="text-yellow-300">fetch</span><span className="text-white/70">(</span>
              </div>
              <div className="pl-4 text-emerald-400">{`'https://api.eikon.studio/v1/generate'`}<span className="text-white/70">,</span></div>
              <div className="pl-4 text-white/70">{"{"}</div>
              <div className="pl-8"><span className="text-blue-300">method</span><span className="text-white/70">:</span> <span className="text-emerald-400">{`'POST'`}</span><span className="text-white/70">,</span></div>
              <div className="pl-8"><span className="text-blue-300">headers</span><span className="text-white/70">:</span> {"{"} <span className="text-emerald-400">{`'Authorization'`}</span><span className="text-white/70">:</span> <span className="text-emerald-400">apiKey</span> {"}"}<span className="text-white/70">,</span></div>
              <div className="pl-8"><span className="text-blue-300">body</span><span className="text-white/70">:</span> <span className="text-yellow-300">JSON</span><span className="text-white/70">.</span><span className="text-yellow-300">stringify</span><span className="text-white/70">({"{"}</span></div>
              <div className="pl-12"><span className="text-blue-300">images</span><span className="text-white/70">:</span> <span className="text-white/70">[</span><span className="text-emerald-400">image1</span><span className="text-white/70">,</span> <span className="text-emerald-400">image2</span><span className="text-white/70">],</span></div>
              <div className="pl-12"><span className="text-blue-300">style</span><span className="text-white/70">:</span> <span className="text-emerald-400">{`'photorealistic'`}</span></div>
              <div className="pl-8 text-white/70">{"})"}</div>
              <div className="pl-4 text-white/70">{"}"}</div>
              <div className="text-white/70">);</div>
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </span>
            <span className="text-xs uppercase tracking-wider text-blue-600 font-medium">Developer API</span>
          </div>
          <h3 className="text-2xl font-semibold mb-4 tracking-tight">
            Build with a powerful REST API
          </h3>
          <p className="text-foreground/60 mb-6 leading-relaxed">
            Integrate Eikon directly into your applications. Our comprehensive API lets you 
            automate image processing at any scale.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">RESTful endpoints with JSON responses</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">Webhook support for async processing</span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-foreground/70">SDKs for Python, Node.js, and Go</span>
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

