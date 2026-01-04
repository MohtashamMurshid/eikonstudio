import Link from "next/link";

export function Hero() {
  return (
    <main className="pt-40 pb-20 px-6 relative">
      <div className="max-w-4xl mx-auto text-center">
        {/* Announcement badge */}
        <div className="inline-flex items-center gap-2 mb-8">
          <span className="w-2 h-2 bg-foreground rounded-full" />
          <span className="text-xs uppercase tracking-widest text-foreground/60">
            New Feature Available
          </span>
          <span className="text-xs text-emerald-500 font-medium uppercase tracking-wider">
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
          Eikon combines, transforms, and generates images with AI — built
          for designers, creators, and developers who demand precision.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-4">
          <Link
            href={"/studio/create"}
            className="px-8 py-3.5 bg-emerald-500 text-white font-medium rounded-lg text-sm hover:bg-emerald-600 transition-all"
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
    </main>
  );
}

