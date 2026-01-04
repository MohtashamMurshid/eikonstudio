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
          <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-[100px]" />
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
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-black font-bold shrink-0">
                  U
                </div>
                <p className="text-white/90 leading-relaxed">
                  Combine product photos with lifestyle backgrounds.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs shrink-0">
                  <LogoIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
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
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-black font-bold shrink-0">
                  U
                </div>
                <p className="text-white/90 leading-relaxed">
                  Generate variations with warm tones.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs shrink-0">
                  <LogoIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
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
  );
}

