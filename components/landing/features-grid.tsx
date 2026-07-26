export function FeaturesGrid() {
  return (
    <section id="features" className="max-w-5xl mx-auto mt-24">
      <h2 className="text-3xl font-semibold text-center mb-16 tracking-tight">
        Built for creators
      </h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* AI Image Generation */}
        <div className="bg-card p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">AI Image Generation</h3>
          <p className="text-sm text-foreground/60 leading-relaxed">
            Create and edit images with Gemini 3 Pro or GPT Image 2. 17 art styles and 13 skill presets included.
          </p>
        </div>

        {/* Video Generation */}
        <div className="bg-card p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-violet-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Video Generation</h3>
          <p className="text-sm text-foreground/60 leading-relaxed">
            Generate videos with Veo 3.1. Text-to-video, image animation, and frame interpolation.
          </p>
        </div>

        {/* Gallery & Organization */}
        <div className="bg-card p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Gallery & History</h3>
          <p className="text-sm text-foreground/60 leading-relaxed">
            Organize creations in folders, browse generation history, and reference past work with @mentions.
          </p>
        </div>

        {/* Developer API */}
        <div className="bg-card p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Developer API</h3>
          <p className="text-sm text-foreground/60 leading-relaxed">
            REST API with interactive playground. Code examples for curl, JavaScript, and Python.
          </p>
        </div>
      </div>
    </section>
  );
}
