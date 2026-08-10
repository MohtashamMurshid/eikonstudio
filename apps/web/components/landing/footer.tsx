import Link from "next/link";
import { Github } from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";

const footerLinks = [
  ["Model catalog", "/models"],
  ["API documentation", "/api-docs"],
  ["Pricing (BYOK)", "/#pricing"],
  ["Providers", "/#providers"],
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-foreground/10">
      <div className="grid sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3 px-6 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-5 items-center justify-center bg-foreground text-background">
              <LogoIcon className="size-3" strokeWidth={2} />
            </span>
            <span className="text-[10px] font-semibold">Eikon Studio</span>
          </div>
          <p className="max-w-[300px] text-[10px] leading-5 text-foreground/40">
            Open source, self-hostable image and video generation. Bring your
            own provider keys — Eikon never adds a markup.
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-foreground/10 sm:flex sm:border-l sm:border-t-0">
          {footerLinks.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="ui-pressable flex items-center border-b border-r border-foreground/10 px-5 py-4 text-[8px] uppercase tracking-[0.15em] text-foreground/45 last:border-r-0 hover:text-foreground sm:border-b-0"
            >
              {label}
            </Link>
          ))}
          <a
            href="https://github.com/mohtashammurshid/eikonstudio"
            target="_blank"
            rel="noopener noreferrer"
            className="ui-pressable col-span-2 flex items-center gap-2 border-t border-foreground/10 px-5 py-4 text-[8px] uppercase tracking-[0.15em] text-foreground/45 hover:text-foreground sm:col-span-1 sm:border-l sm:border-t-0"
          >
            <Github className="size-3" strokeWidth={1.5} />
            GitHub · Apache-2.0
          </a>
        </div>
      </div>
    </footer>
  );
}
