import Link from "next/link";
import { Github } from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";

export function LandingFooter() {
  return (
    <footer className="grid border-t border-foreground/10 sm:grid-cols-[1fr_auto]">
      <div className="flex items-center gap-3 px-6 py-4 sm:px-8">
        <span className="flex size-5 items-center justify-center bg-foreground text-background">
          <LogoIcon className="size-3" strokeWidth={2} />
        </span>
        <span className="text-[10px] font-semibold">Eikon</span>
      </div>
      <div className="flex items-center border-t border-foreground/10 sm:border-l sm:border-t-0">
        <Link
          href="/api-docs"
          className="ui-pressable border-r border-foreground/10 px-5 py-4 text-[8px] uppercase tracking-[0.15em] text-foreground/45 hover:text-foreground"
        >
          Documentation
        </Link>
        <a
          href="https://github.com/mohtashammurshid/eikonstudio"
          target="_blank"
          rel="noopener noreferrer"
          className="ui-pressable flex items-center gap-2 px-5 py-4 text-[8px] uppercase tracking-[0.15em] text-foreground/45 hover:text-foreground"
        >
          <Github className="size-3" strokeWidth={1.5} />
          GitHub
        </a>
      </div>
    </footer>
  );
}
