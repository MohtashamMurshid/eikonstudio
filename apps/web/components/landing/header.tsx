"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navigation = [
  ["Workbench", "/studio"],
  ["Models", "/models"],
  ["Capabilities", "/#capabilities"],
  ["Process", "/#process"],
  ["API", "/api-docs"],
] as const;

export function LandingHeader() {
  const { isAuthenticated } = useConvexAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="relative z-50 border-b border-foreground/10 bg-background/95"
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
    >
      <div className="grid h-11 grid-cols-[1fr_auto] items-stretch lg:grid-cols-[1.2fr_2fr_1.2fr]">
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
          className="hidden items-stretch justify-center border-x border-foreground/10 lg:flex"
          aria-label="Primary navigation"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="ui-pressable flex items-center border-r border-foreground/10 px-6 text-[9px] uppercase tracking-[0.16em] text-foreground/55 first:border-l hover:bg-foreground/[0.035] hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-stretch justify-end">
          <div className="flex items-center border-l border-foreground/10 px-1.5">
            <ThemeToggle />
          </div>
          <Link
            href={isAuthenticated ? "/studio" : "/auth"}
            className="ui-pressable hidden items-center gap-2 border-l border-foreground/10 bg-foreground px-5 text-[9px] font-medium uppercase tracking-[0.14em] text-background hover:opacity-85 sm:flex"
          >
            {isAuthenticated ? "Open studio" : "Start creating"}
            <ArrowUpRight className="size-3" strokeWidth={1.5} />
          </Link>
          <button
            type="button"
            className="ui-pressable flex items-center border-l border-foreground/10 px-4 lg:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="size-4" strokeWidth={1.5} />
            ) : (
              <Menu className="size-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="landing-mobile-nav"
          className="absolute inset-x-0 top-full grid grid-cols-2 border-b border-foreground/10 bg-background shadow-[0_18px_40px_rgba(0,0,0,0.12)] sm:grid-cols-5 lg:hidden"
          aria-label="Compact navigation"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="ui-pressable flex h-12 items-center justify-between border-r border-t border-foreground/10 px-5 text-[8px] uppercase tracking-[0.16em] text-foreground/55 hover:bg-foreground/[0.035] hover:text-foreground"
            >
              {label}
              <ArrowUpRight className="size-3" strokeWidth={1.5} />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
