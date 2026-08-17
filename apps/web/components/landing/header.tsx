"use client";

import Link from "next/link";
import { useState } from "react";
import { useConvexAuth } from "convex/react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { LogoIcon } from "@/components/logo-icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navigation = [
  ["Features", "/#features"],
  ["Process", "/#process"],
  ["Models", "/models"],
  ["API", "/api-docs"],
  ["About", "/#about"],
] as const;

export function LandingHeader() {
  const { isAuthenticated } = useConvexAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="landing-header landing-border relative z-50 border-b backdrop-blur-md"
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
    >
      <div className="mx-auto grid h-[60px] max-w-[1540px] grid-cols-[1fr_auto] items-stretch px-5 sm:px-8 lg:grid-cols-[1fr_auto_1fr] lg:px-10">
        <Link
          href="/"
          className="ui-pressable flex items-center gap-2.5"
          aria-label="Eikon home"
        >
          <span className="landing-inverse flex size-7 items-center justify-center rounded-full">
            <LogoIcon className="size-4" strokeWidth={2} />
          </span>
          <span className="font-sans text-[19px] font-semibold tracking-[-0.055em]">eikon</span>
        </Link>

        <nav
          className="hidden items-center justify-center gap-9 lg:flex"
          aria-label="Primary navigation"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="ui-pressable landing-muted font-sans text-[12px] font-medium tracking-[-0.02em] hover:text-[var(--landing-ink)]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-1.5">
          <div className="landing-theme-toggle">
            <ThemeToggle />
          </div>
          <Link
            href={isAuthenticated ? "/studio" : "/auth"}
            className="ui-pressable landing-soft hidden h-10 items-center gap-2 rounded-full px-5 font-sans text-[12px] font-semibold tracking-[-0.025em] sm:flex"
          >
            {isAuthenticated ? "Open studio" : "Start creating"}
            <ArrowUpRight className="size-3" strokeWidth={1.5} />
          </Link>
          <button
            type="button"
            className="ui-pressable landing-border ml-1 flex size-10 items-center justify-center rounded-full border lg:hidden"
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
          className="landing-header landing-border absolute inset-x-0 top-full grid grid-cols-2 border-y p-3 shadow-[0_18px_40px_rgba(0,0,0,0.12)] sm:grid-cols-5 lg:hidden"
          aria-label="Compact navigation"
        >
          {navigation.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="ui-pressable landing-muted flex h-12 items-center justify-between rounded-md px-4 font-sans text-[12px] font-medium hover:bg-[var(--landing-soft)] hover:text-[var(--landing-ink)]"
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
