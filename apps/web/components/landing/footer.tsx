import Link from "next/link";
import { Github } from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";

export function LandingFooter() {
  return (
    <footer className="landing-soft landing-border grid border-t sm:grid-cols-[1fr_auto]">
      <div className="flex items-center gap-3 px-6 py-5 sm:px-8">
        <span className="landing-inverse flex size-6 items-center justify-center rounded-full">
          <LogoIcon className="size-3" strokeWidth={2} />
        </span>
        <span className="font-sans text-[13px] font-semibold tracking-[-0.03em]">eikon</span>
        <span className="landing-faint ml-2 font-sans text-[9px] uppercase tracking-[0.14em]">Open visual intelligence</span>
      </div>
      <div className="landing-border flex items-center border-t sm:border-l sm:border-t-0">
        <Link
          href="/models"
          className="ui-pressable landing-border landing-muted border-r px-5 py-5 font-sans text-[9px] uppercase tracking-[0.15em] hover:text-[var(--landing-ink)]"
        >
          Models
        </Link>
        <Link
          href="/api-docs"
          className="ui-pressable landing-border landing-muted border-r px-5 py-5 font-sans text-[9px] uppercase tracking-[0.15em] hover:text-[var(--landing-ink)]"
        >
          Documentation
        </Link>
        <a
          href="https://github.com/mohtashammurshid/eikonstudio"
          target="_blank"
          rel="noopener noreferrer"
          className="ui-pressable landing-muted flex items-center gap-2 px-5 py-5 font-sans text-[9px] uppercase tracking-[0.15em] hover:text-[var(--landing-ink)]"
        >
          <Github className="size-3" strokeWidth={1.5} />
          GitHub
        </a>
      </div>
    </footer>
  );
}
