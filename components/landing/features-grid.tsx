export function FeaturesGrid() {
  return (
    <section id="features" className="max-w-5xl mx-auto mt-24">
      <h2 className="text-3xl font-semibold text-center mb-16 tracking-tight">
        Built for precision
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-card p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-4">
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

        <div className="bg-card p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-4">
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

        <div className="bg-card p-6 rounded-2xl border border-border hover:shadow-lg transition-all">
          <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-4">
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
  );
}

