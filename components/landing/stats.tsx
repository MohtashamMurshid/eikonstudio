export function Stats() {
  return (
    <section className="max-w-5xl mx-auto mt-0">
      <div className="grid md:grid-cols-3 divide-x divide-border border-t border-b border-border bg-white">
        <div className="p-8 text-center md:text-left">
          <div className="text-4xl font-semibold tracking-tight mb-2">&lt;10s</div>
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
  );
}

