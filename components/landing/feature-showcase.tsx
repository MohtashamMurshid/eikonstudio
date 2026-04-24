import Image from "next/image";
import { LogoIcon } from "@/components/logo-icon";

export function FeatureShowcase() {
  return (
    <div className="max-w-5xl mx-auto mt-20">
      <div className="relative rounded-2xl overflow-hidden">
        {/* Gradient background with particle effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#065f46]">
          {/* Particle/noise effect overlay */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: `
                radial-gradient(circle at 1px 1px, rgba(16, 185, 129, 0.3) 1px, transparent 0),
                radial-gradient(circle at 3px 3px, rgba(255, 255, 255, 0.1) 1px, transparent 0)
              `,
              backgroundSize: "20px 20px, 30px 30px",
            }}
          />
          {/* Glow effects */}
          <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-violet-500/15 rounded-full blur-[100px]" />
        </div>

        {/* Terminal windows */}
        <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-6">
          {/* Left terminal - Image Generation */}
          <div className="flex-1 bg-black/90 backdrop-blur rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs text-white/40">Image Generation</span>
            </div>
            <div className="p-5 space-y-4 font-mono text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-black font-bold shrink-0">
                  U
                </div>
                <p className="text-white/90 leading-relaxed">
                  A futuristic cityscape at sunset <span className="text-emerald-400">/cinematic</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs shrink-0">
                  <LogoIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                </div>
                <div className="text-white/70 leading-relaxed">
                  <p>Generated in <span className="text-white font-medium">4K resolution</span></p>
                  <p className="text-xs text-white/50 mt-1">Style: cinematic, anamorphic lens flare</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-black font-bold shrink-0">
                  U
                </div>
                <p className="text-white/90 leading-relaxed">
                  Add <span className="text-blue-400">@product-hero.png</span> to the scene
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs shrink-0">
                  <LogoIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                </div>
                <p className="text-white/70 leading-relaxed">
                  Combined image saved to{" "}
                  <span className="text-white font-medium">Gallery</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right terminal - Video Generation */}
          <div className="flex-1 bg-black/90 backdrop-blur rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-xs text-white/40">Video Generation</span>
            </div>
            <div className="p-5 space-y-4 font-mono text-sm">
              {/* Video generation progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-white/60">
                  <span className="text-xs text-white/50">Text to Video</span>
                  <span className="text-xs text-emerald-400">Veo 3.1</span>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-white/80 text-xs leading-relaxed">
                    &quot;A drone shot flying through cherry blossom trees, 
                    petals gently falling, golden hour lighting&quot;
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">Generating video...</span>
                  <span className="text-emerald-400">78%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-[78%] bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" />
                </div>
              </div>

              {/* Settings */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-xs text-white/50">1080p</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-xs text-white/50">16:9</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-xs text-white/50">8 sec</span>
                </div>
              </div>

              {/* Recent videos */}
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-white/40 mb-2">Recent</p>
                <div className="flex gap-2">
                  <div className="relative w-12 h-8 overflow-hidden rounded border border-white/10">
                    <Image
                      src="/neon-city-rain.png"
                      alt="Recent generated neon city video thumbnail"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <svg className="w-3 h-3 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="relative w-12 h-8 overflow-hidden rounded border border-white/10">
                    <Image
                      src="/ocean-cliffs-aerial.png"
                      alt="Recent generated ocean cliffs video thumbnail"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <svg className="w-3 h-3 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="relative w-12 h-8 overflow-hidden rounded border border-white/10">
                    <Image
                      src="/sakura-castle-cityscape.png"
                      alt="Recent generated cherry blossom city video thumbnail"
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <svg className="w-3 h-3 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
