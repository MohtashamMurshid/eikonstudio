"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { ArrowUpRight, Menu } from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function LandingHeader() {
  const { isAuthenticated } = useConvexAuth();

  return (
    <header className="relative z-50 border-b border-foreground/15 bg-background/95">
      <div className="grid h-14 grid-cols-[1fr_auto] items-stretch lg:grid-cols-[1.2fr_2fr_1.2fr]">
        <Link
          href="/"
          className="ui-pressable flex items-center gap-2.5 px-4 sm:px-6"
          aria-label="Eikon home"
        >
          <span className="flex size-6 items-center justify-center bg-foreground text-background">
            <LogoIcon className="size-3.5" strokeWidth={2} />
          </span>
          <span className="text-[13px] font-semibold tracking-[-0.02em]">Eikon</span>
          <span className="hidden text-[8px] uppercase tracking-[0.2em] text-foreground/35 sm:inline">
            Studio v1.0
          </span>
        </Link>

        <nav
          className="hidden items-stretch justify-center border-x border-foreground/15 lg:flex"
          aria-label="Primary navigation"
        >
          {[
            ["Workbench", "/studio"],
            ["Capabilities", "#capabilities"],
            ["Process", "#process"],
            ["API", "/api-docs"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="ui-pressable flex items-center border-r border-foreground/15 px-6 text-[9px] uppercase tracking-[0.16em] text-foreground/55 first:border-l hover:bg-foreground/[0.035] hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-stretch justify-end">
          <div className="hidden items-center gap-2 border-l border-foreground/15 px-4 sm:flex">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[8px] uppercase tracking-[0.16em] text-foreground/50">
              Systems online
            </span>
          </div>
          <div className="flex items-center border-l border-foreground/15 px-1.5">
            <ThemeToggle />
          </div>
          <Link
            href={isAuthenticated ? "/studio" : "/auth"}
            className="ui-pressable hidden items-center gap-2 border-l border-foreground/15 bg-foreground px-5 text-[9px] font-medium uppercase tracking-[0.14em] text-background hover:opacity-85 sm:flex"
          >
            {isAuthenticated ? "Open studio" : "Start creating"}
            <ArrowUpRight className="size-3" strokeWidth={1.5} />
          </Link>
          <Link
            href="/studio"
            className="ui-pressable flex items-center border-l border-foreground/15 px-4 lg:hidden"
            aria-label="Open studio navigation"
          >
            <Menu className="size-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </header>
  );
}
