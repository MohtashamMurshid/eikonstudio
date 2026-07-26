export function Stats() {
  return (
    <section className="max-w-5xl mx-auto mt-0">
      <div className="grid md:grid-cols-3 divide-x divide-border border-t border-b border-border bg-card">
        <div className="p-8 text-center md:text-left">
          <div className="text-4xl font-semibold tracking-tight mb-2">1K–4K</div>
          <div className="text-sm text-foreground/50">Resolution presets & aspect ratios</div>
        </div>
        <div className="p-8 text-center md:text-left">
          <div className="text-4xl font-semibold tracking-tight mb-2">Text + edits</div>
          <div className="text-sm text-foreground/50">Generate from prompts or refine existing images</div>
        </div>
        <div className="p-8 text-center md:text-left">
          <div className="text-4xl font-semibold tracking-tight mb-2">REST API</div>
          <div className="text-sm text-foreground/50">Documented endpoint for your own workflows</div>
        </div>
      </div>
    </section>
  );
}

